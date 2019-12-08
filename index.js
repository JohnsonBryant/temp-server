'use strict';
const fs = require('fs');
const path = require('path');
const jsonfile = require('jsonfile');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const SerialPort = require('serialport');
const util = require('./myutil.js'); // 程序关键配置参数，功能函数，初始化函数
let SqliteDB = require('./sqliteDB').SqliteDB;
const Packet = require('./packetParser.js'); // 数据解析模板

util.initConf(); // 程序配置目录及文件初始化检查 / 生成
// 全局参数变量
const sqliteDB = new SqliteDB(path.join(__dirname, 'data.db')); // 数据库对象，封装必要功能函数
const app = express(); // express app object
const httpServer = http.Server(app); // http server
const io = socketIo(httpServer); // websocket server
const Config = require('./conf/config.json'); // main config of program
let program = {
  buf: Buffer.alloc(0),
  isOnTest: false,
  cycle: 10,
  isSendding: true,
  equipments: [],
  IDS: [],
  cache: {},
};

// 串口
const serialport = new SerialPort(Config.SerialPortName, {
  baudRate: parseInt(Config.BaudRate)
});
// 打开串口
serialport.open(() => {
  // serialport.write(`Open serialport ${Config.SerialPortName} successed!`);
});
// 串口错误
serialport.on('error', (message) => {
  console.error(util.nowtime(), message);
});
// 串口数据接收
serialport.on('data', (data) => {
  if (!data) {
    return;
  }

  let bufLen = program.buf.length + data.length;
  program.buf = Buffer.concat([program.buf, data], bufLen);

  processbuf(program);
})
// 串口数据校验处理
const processbuf = function (program) {
  while (program.buf.length > Packet.minlen) {
    if (program.buf[0] === 0xAA && program.buf[1] === 0x55) {
      let packlen = program.buf.readUInt8(3) + Packet.minlen;
      if(program.buf.length < packlen){
        break;
      }
      let bufPack = Buffer.alloc(packlen);
      program.buf.copy(bufPack, 0, 0, packlen);
      // util._event.emit(util.AppEvents.parse, bufPack);
      parseData(bufPack);

      let bufremain = Buffer.alloc(program.buf.length - packlen);
      program.buf.copy(bufremain, 0, packlen, program.buf.length);
      program.buf = bufremain;
    } else {
      let bufremain = Buffer.alloc(program.buf.length - 1);
      program.buf.copy(bufremain, 0, 1, program.buf.length);
      program.buf = bufremain;
    }
  }
};

function parseData(packbuf) {
  if (!program.isOnTest) { // 系统未在测试状态
    console.log('系统未在测试状态，收到数据字节: ' + `${packbuf.toString('hex')}`);
    return;
  }
  if (packbuf.readUInt8(2) === 0xD1) {
    io.emit(util.AppEvents.parse, packbuf);
  } else {
    let DirectivePack = Packet.DirectivePackParser.parse(packbuf);
    directiveAction(io, DirectivePack); // 处理各种数据指令事件
  }
}

// 监听解析传感器数据数据， 对数据进行解析
util._event.on(util.AppEvents.parse, (packbuf) => {
  // 解析处理传感器数据
  let DataPack = Packet.DataPackParser.parse(packbuf);
  if (program.IDS.includes(DataPack.deviceID)) {
    // 传感器ID在配置中， 对应测试中的某个仪器
    program.cache[DataPack.deviceID.toString()] = {  // 缓存在配置中的传感器的温湿度数据
      temp: DataPack.temp,
      humi: DataPack.humi,
      batt: DataPack.batt,
    };
  } else {
    // 传感器ID不在配置中
    io.emit(util.ioEvent.unconfigedDataMsg, DataPack);
  }
});

// 处理系统定义的指令数据包
function directiveAction(io, pack) {
  let command = pack.command.toString(16).toUpperCase();
  let commands = {
    'A0': () => {
      // 成功修改传感器 ID，推送数据对象到前端
      io.emit(util.ioEvent.directiveModifyID, pack);
    },
    'A1': () => {
      // 搜索传感器应答数据，推送数据对象到前端，可获取到单个在线的传感器ID号
      io.emit(util.ioEvent.directiveSearchSensors, pack);
    },
    'CF': () => {
      // 主节点一轮上报数据到应用端的开始 / 结束信号
      let key = pack.reserv[0];
      if (key === 0x01) { // 主节点一轮上报数据的开始标志
        
      } else if (key === 0x01) { // 主节点一轮上报数据的结束标志
        updateEquipmentData(program); // 更新程序主缓存的数据， 计算更新检测数据
        // 更新数据到前端
        
      }
      program.cache = {};
    }
  };
  if (typeof commands[command] !== 'function') {
    console.log('无效的数据指令字节 ' + command + ' !!!');
    return;
  }
  commands[command]();
}

// 主节点一轮上报数据结束，从缓存中检查，仪器下挂载的传感器是否均收到数据， 计算更新均匀度、波动度、偏差
function updateEquipmentData(program) {
  let time = util.nowtime();
  let data = program.cache;
  program.equipments.forEach((equipment, index, equipments) => {
    let IDS = equipment.data.IDS;
    if ( IDS.every(id => data.hasOwnProperty(id)) ) { // 仪器挂载的传感器全部收到数据
      // 更新仪器下挂载的传感器的数据
      IDS.forEach((id) => {
        equipment.data[id]['temp'].push(data[id].temp);
        equipment.data[id]['humi'].push(data[id].humi);
        equipment.data[id]['batt'].push(data[id].batt);
      });
      // 计算更新仪器的 温度 / 湿度 的均匀度、波动度、偏差
      let tempConfig = equipment.config.temp;
      let humiConfig = equipment.config.humi;
      let centerID = equipment.config.centerID;
      let centerSensor = equipment.data[centerID];
      let evennessTemp;
      let fluctuationTemp;
      let deviationTemp;
      let evennessHumi;
      let fluctuationHumi;
      let deviationHumi;
      let arrtemp = [];
      let arrhumi = [];
      for (let i = 0; i < centerSensor['temp'].length; i++) {
        let roundtemp = IDS.map(id => equipment.data[id]['temp'][i]);
        let roundhumi = IDS.map(id => equipment.data[id]['humi'][i]);

        arrtemp.push(util.Max(roundtemp) - util.Min(roundtemp));
        arrhumi.push(util.Average(roundhumi) - util.Min(roundhumi));
      }
      evennessTemp = util.Average(arrtemp);
      fluctuationTemp = centerSensor['temp'].length === 1 ?
        data[centerID].temp : 
        util.Max(centerSensor['temp']) - util.Min(centerSensor['temp']);
      deviationTemp = tempConfig - util.Average(centerSensor['temp']);
      
      evennessHumi = util.Average(arrhumi);
      fluctuationHumi = centerSensor['humi'].length === 1 ?
        data[centerID].humi : 
        util.Max(centerSensor['humi']) - util.Min(centerSensor['humi']);
      deviationHumi = humiConfig - util.Average(centerSensor['humi']);
      
      equipment.data['evennessTemp'].push(evennessTemp);
      equipment.data['fluctuationTemp'].push(fluctuationTemp);
      equipment.data['deviationTemp'].push(deviationTemp);
      equipment.data['evennessHumi'].push(evennessHumi);
      equipment.data['fluctuationHumi'].push(fluctuationHumi);
      equipment.data['deviationHumi'].push(deviationHumi);
      equipment.data['time'].push(time);
    } else { // 仪器挂载的传感器未全部收到数据
      console.log(`仪器对应的传感器数据本次未全部收到`);
      console.log(equipment);
    }
  });
}

// websocket server 客户端连接事件，下发连接成功提示到客户端
io.on(util.ioEvent.connection, (socket) => {
  io.emit(util.ioEvent.connectMsg, `you have connectted with websocket server, please waiting for message update!`);
});


// 添加路由中间件，解析JSON、 encoded 数据
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
// webserver
app.use('/', express.static(path.join(__dirname, '/dist')));
// httpServer 侦听
httpServer.listen(8080, () => {
  let host = httpServer.address().address;
  let port = httpServer.address().port;
  console.log(util.nowtime(), `webserver listening at ${host}:${port}`);
});

// 应用根路径，路由到 index.html
app.get('/', (req, res) => {
  res.sendFile('/index.html');
});

// 获取配置信息（串口参数、电池参数） 接口
app.get('/config/get', function (req, res) {
  let config = jsonfile.readFileSync(util.confPathList[1]);
  res.send({
    SerialPortName: config.SerialPortName ,
    BaudRate: parseInt(config.BaudRate),
    BatteryLow: parseFloat(config.BatteryLow),
    BatteryHigh: parseFloat(config.BatteryHigh),
  });
});

// 修改串口配置信息 接口
app.post('/serialportConf/set', function (req, res) {
  let recieve = req.body;
  // 串口检查，必须为 COM + 1 格式
  let serialPortNameCheck1 = recieve.SerialPortName.length <= 3; // 字符串长度不够
  let serialPortNameCheck2 = recieve.SerialPortName.slice(0,3).toUpperCase() !== 'COM'; // 字符串不是以 COM / com 开头
  let serialPortNameCheck3 = isNaN(Number(recieve.SerialPortName.slice(3))); // COM 后的字符包含非数字字符
  let serialPortNameCheck4 = !util.isPositiveInteger(Number(recieve.SerialPortName.slice(3)))
  if (serialPortNameCheck1 || serialPortNameCheck2 || serialPortNameCheck3 || serialPortNameCheck4) {
    res.send(new util.ResponseTemplate(false, '错误，串口号输入错误，请按 "COM9" 格式输入！'));
    return;
  }
  // 波特率检查，必须为正整数，且应符合标准常用波特率值 myutil.CommonBaudRate 数组中的值
  if (!util.isPositiveInteger(recieve.BaudRate) || !util.CommonBaudRate.includes(recieve.BaudRate)) {
    res.send(new util.ResponseTemplate(false, '错误，波特率输入错误，应输入正整数的波特率值，请检查后输入！'));
    return;
  }

  let confRecv = {
    SerialPortName: recieve.SerialPortName,
    BaudRate: recieve.BaudRate
  };
  // 保存到配置文件 conf/config.json
  let saveResult = util.saveJsonToConf(confRecv, util.confPathList[1]);
  let message = saveResult ? '串口参数修改成功！' : '串口参数修改失败，错误原因写入配置文件出错！';
  res.send(new util.ResponseTemplate(saveResult, message));
});

// 修改电池电量参数 接口
app.post('/batteryConf/set', function (req, res) {
  // 电量参数必须为正数，接受小数
  let recieve = req.body;
  if (recieve === undefined || !util.isPositiveNumber(recieve.BatteryLow) || !util.isPositiveNumber(recieve.BatteryHigh)) {
    res.send(new util.ResponseTemplate(false, '电池电量参数错误，电池参数必须为正数，请检查后重新提交！'));
    return;
  }
  // LowBattery >= HighBattery
  if (recieve.BatteryLow >= recieve.BatteryHigh) {
    res.send(new util.ResponseTemplate(false, '电池电量参数错误，电量参数的下限值应小于上限值，请检查后重新提交！'));
    return;
  }

  let confRecv = {
    BatteryLow: recieve.BatteryLow,
    BatteryHigh: recieve.BatteryHigh
  };
  // 保存到配置文件 conf/config.json
  let saveResult = util.saveJsonToConf(confRecv, util.confPathList[1]);
  let message = saveResult ? '电池参数修改成功！' : '电池参数修改失败，错误原因写入配置文件出错！';
  res.send(new util.ResponseTemplate(saveResult, message));
});

// 搜索传感器 接口
app.get('/searchSensor', (req, res) => {
  // 接收到前端请求后，调用串口发送数据到主节点(确认数据包格式)
  let bufstr = 'AA55'+'A1'+'06'+'0B'+'00'+'00000000'+'00';
  let buf = Buffer.from(bufstr, 'hex');
  // 调用串口发送数据到主节点
  serialport.write(buf, (err) => {
    if (!err) {
      res.send(new util.ResponseTemplate(true, '搜索传感器指令发送成功'));
    } else {
      res.send(new util.ResponseTemplate(false, '串口写入错误，搜索传感器指令发送失败！'));
    }
  });
});

// 修改传感器ID
app.post('/idSet', (req, res) => {
  let recieve = req.body;
  // 是否接收0？
  // 校验数据， 原传感器ID、预设传感器ID均必须为数值
  if (recieve === undefined || !util.isInteger(recieve.originID) || !util.isInteger(recieve.newID)) {
    res.send(new util.ResponseTemplate(false, '传入的ID参数错误，请检查后重新提交！'));
    return;
  }
  // 检查数值是否超限 0 -255，不可为负值，不可大于255
  if (recieve.originID < 0 || recieve.originID > 255 || recieve.newID < 0 || recieve.newID > 255) {
    res.send(new util.ResponseTemplate(false, '传入的ID参数越界，必须为0-255之间的数值，请检查后重新提交！'));
    return;
  }
  // 原ID与预设ID相等，直接返回成功提示，不做任何处理。
  if (recieve.originID === recieve.newID) {
    res.send(new util.ResponseTemplate(true, '修改ID指令发送成功！'));
    return;
  }
  // 解析打包数据(构建为约定的数据格式)
  let bufstr = 'AA55A0060B'+ recieve.originID.toString(16).padStart(2, '0') + recieve.newID.toString(16).padStart(2, '0') +'0000000000';
  let buf = Buffer.from(bufstr, 'hex');
  // 调用串口发送数据到主节点
  serialport.write(buf, (err) => {
    if (!err) {
      res.send(new util.ResponseTemplate(true, '修改ID指令发送成功！'));
    } else {
      res.send(new util.ResponseTemplate(false, '串口写入错误，修改ID指令发送失败！'));
    }
  });
});

// 获取测试模板信息 接口
app.get('/testTemplate/get', function (req, res) {
  let testTemplate = jsonfile.readFileSync(util.confPathList[2]);
  res.send({
    cycle: parseInt(testTemplate.cycle),
    temp: parseFloat(testTemplate.temp),
    humi: parseFloat(testTemplate.humi),
    centerID: parseInt(testTemplate.centerID),
    IDS: testTemplate.IDS,
    isSendding: testTemplate.isSendding,
  });
});

// 修改测试模板信息 接口
app.post('/testTemplate/set', function (req, res) {
  let recieve = req.body;
  if (recieve === undefined) {
    res.send(new util.ResponseTemplate(false, '请求有误！数据错误！'));
    return;
  }
  // 获取数据周期检查，周期应为正整数，且在 1 - 65535 范围内
  let cycle = recieve.cycle;
  if (!util.isPositiveInteger(cycle) || cycle < 1 || cycle > 65535) {
    res.send(new util.ResponseTemplate(false, '工作周期应输入数值，且在 1 - 65535 范围内，请重新输入！'));
    return;
  }
  // 温度示值检查
  let temp = recieve.temp;
  if (!util.isValidNumber(temp)) {
    res.send(new util.ResponseTemplate(false, '温度示值应输入有效数值，不可输入非数字字符，请重新输入！'));
  }
  // 湿度示值检查
  let humi = recieve.humi;
  if (!util.isPositiveNumber(humi)) {
    res.send(new util.ResponseTemplate(false, '湿度示值应输入有效数值，不可输入非数字字符，请重新输入！'));
  }
  // 中心点ID检查
  let centerID = recieve.centerID;
  if (!util.isPositiveInteger(centerID) || centerID <= 0 || centerID > 255) {
    res.send(new util.ResponseTemplate(false, '中心点ID应输入 0 - 255 范围内的有效数值，请重新输入！'));
    return;
  }
  // 其他ID与中心点ID检查， IDS输入要求为数值数组
  let IDS = recieve.IDS;
  if ( !(IDS instanceof Array) || IDS.length < 1 ) {
    res.send(new util.ResponseTemplate(false, '其他传感器ID输入内容有误，请重新输入！'));
    return;
  }
  let idsCheck = IDS.concat(centerID).some((elem, index, arr) => {
    return !util.isPositiveInteger(elem) || elem <= 0 || elem > 255 || (arr.indexOf(elem) != arr.lastIndexOf(elem));
  });
  if (idsCheck) {
    res.send(new util.ResponseTemplate(false, '传感器ID输入有误，请勿输入非数值字符，且不可输入重复的ID！'));
    return;
  }

  let confRecv = {
    cycle: cycle ,
    temp: temp,
    humi: humi,
    centerID: centerID,
    IDS: IDS.join(','),
    isSendding: req.body.isSendding,
  };
  // 保存到配置文件 conf/config.json
  let result = util.saveJsonToConf(confRecv, util.confPathList[2]);
  res.send(new util.ResponseTemplate(true, '测试模板保存成功！'));
});

// 获取最近5条委托单位信息
app.get('/getLastestFiveCompanys', (req, res) => {
  // 接收到前端请求后，从数据表（测试设备）中，查询所有委托单位信息
  sqliteDB.queryData('select distinct company from equipment order by id desc limit 5;', (rows) => {
    res.send(rows);
  });
});

// 获取所有包含指定关键字的所有委托单位信息
app.post('/getAllLikelyCompanys', (req, res) => {
  // 接收到前端请求后，从数据表（测试设备）中，查询所有委托单位信息
  sqliteDB.queryData(`select distinct company from equipment where company like "%${req.body.company}%";`, (rows) => {
    res.send(rows);
  });
});

// 获取最近五条测试设备数据接口
app.get('/lastestFiveTestEq', (req, res) => {
  // 接收到前端请求后，从数据表（测试设备）中，查询最近插入的五条测试设备信息，返回给前端
  sqliteDB.queryData('select id, company, em, deviceName, deviceType, deviceID, insertDate from equipment order by insertDate desc limit 5;', (rows) => {
    res.send(rows);
  });
});

// 插入测试设备数据接口
app.post('/addEquipment', (req, res) => {
  // 接收到前端请求后，解析打包数据(构建为约定的数据格式)，将测试设备信息存储到测试设备表中， 单条记录写入
  let equipment = req.body;
  let eq = equipment[0];
  if ( !(equipment instanceof Array) || equipment.length > 1) {
    // 检查参数必须为数组
    res.send(new util.ResponseTemplate(false, '错误的请求！'));
    return;
  }

  let sqlQuery = `select count(*) as count from equipment where company=? and em=? and deviceName=? and deviceType=? and deviceID=?`;
  // 检查新增的仪器是否已存在
  sqliteDB.queryDataWithParam(sqlQuery, [eq.company, eq.em, eq.deviceName, eq.deviceType, eq.deviceID], (rows) => {
    if (rows[0].count > 0) {
      res.send(new util.ResponseTemplate(false, '仪器已存在，请勿重复添加！'));
      return;
    }
    // 数据写入结果的监测，及返回结果的调整
    sqliteDB.insertData('insert into equipment(company, em, deviceName, deviceType, deviceID, insertDate) values (?, ?, ?, ?, ?, ?);', equipment, (err) => {
      if (!err) {
        res.send(new util.ResponseTemplate(false, '新增仪器失败！'));
      } else {
        res.send(new util.ResponseTemplate(true, '新增仪器成功！'));
      }
    });
  });
});

// 删除单个测试设备数据接口
app.post('/deleteEquipment', (req, res) => {
  // 检查接收参数的正确性
  let param = req.body;
  if (param.id === undefined || !util.isPositiveInteger(param.id)) {
    res.send(new util.ResponseTemplate(false, '操作无效，请按F5刷新后，重新操作！'));
    return;
  }
  let equipmentId = req.body.id;
  let sql = `delete from equipment where id=${equipmentId};`;
  sqliteDB.executeSql(sql, (err) => {
    let result = {
      success: true,
      message: '删除成功！',
    };
    if (err !== null) {
      result.success = false;
      result.message = `删除失败！`;
    }
    res.send(result);
  });
});

// 停止测试接口
app.get('/stopTest', (req, res) => {
  let buf = Buffer.from('AA55'+'CE'+'06'+'0B'+'00000000'+'000000', 'hex');
  serialport.write(buf, (err) => {
    if (!err) {
      // reset variable program
      program.isOnTest = false;
      program.cycle = 10;
      program.isSendding = true;
      program.equipments = [];
      program.IDS = [];
      program.cache = {};

      res.send(new util.ResponseTemplate(true, '停止测试成功！'));
    } else {
      res.send(new util.ResponseTemplate(false, '串口写入错误，发送停止测试指令失败，请重新操作！！！'));
    }
  });
});

// 启动测试接口
app.post('/startTest', (req, res) => {
  // 检查当前是否在系统是否在测试状态
  if (program.isOnTest) {
    res.send(new util.ResponseTemplate(false, '严重错误，当前系统在测试中，请先停止当前测试后，再尝试启动新的测试！'));
    return;
  }

  // 检查前端确认提交的测试仪器及配置信息
  let param = req.body;
  if (param === undefined) {
    // JSON解析失效的错误请求
    res.send(new util.ResponseTemplate(false, '错误请求！！！'));
    return;
  }
  if ( !util.isPositiveInteger(param.cycle) ) {
    // 周期参数错误
    res.send(new util.ResponseTemplate(false, '周期错误，周期必须为数值，且应大于或等于1 ！'));
    return;
  }
  if (!Array.isArray(param.equipments) || param.equipments.length === 0) {
    // 测试仪器信息错误，或测试仪器为空
    res.send(new util.ResponseTemplate(false, '空仪器错误，必须选择一个测试仪器并配置完成后，才能进行测试 ！'));
    return;
  }
  // 测试仪器信息检查
  let devicesTemp = param.equipments.map((item) => {
    return item.device.company + item.device.em + item.device.deviceName + item.device.deviceType + item.device.deviceID;
  });
  if ( devicesTemp.some((item, index, arr) => arr.indexOf(item) !== arr.lastIndexOf(item)) ) {
    // 检查到重复的两个仪器
    res.send(new util.ResponseTemplate(false, '仪器重复错误，不允许在同一次测试中出现两个相同的仪器 ！'));
    return;
  }
  // 测试仪器下挂载的传感器ID检查
  let ids = [];
  param.equipments.forEach((item) => {
    ids.push(item.config.centerID, ...item.config.IDS);
  });
  if ( ids.some((item) => !util.isInteger(item) || (item > 255 || item < 0 ) ) ) {
    // 检查到无效的ID，所有传感器ID均必须为数值，且在0-255范围内
    res.send(new util.ResponseTemplate(false, '传感器ID错误，ID只接受0-255之间的数值 ！'));
    return;
  }
  if ( ids.some((item, index, arr) => arr.indexOf(item) !== arr.lastIndexOf(item)) ) {
    // 检查到重复传感器ID
    res.send(new util.ResponseTemplate(false, '传感器ID错误，测试仪器下挂载的传感器ID存在重复，请检查后重试 ！'));
    return;
  }

  if ( param.equipments.some((item) => !util.isValidNumber(item.config.temp) || !util.isValidNumber(item.config.humi)) ) {
    // 检查到测试仪器配置温湿度示值存在非数值。测试仪器配置的温湿度示值有效性检查，必须为数值
    res.send(new util.ResponseTemplate(false, '测试仪器的温湿度示值输入错误，温湿度示值必须为有效数值 ！'));
    return;
  }

  // 检查当前配置为，仅接收数据测试，不通过串口向主节点下发启动测试数据指令
  if (!param.isSendding) {
    res.send(new util.ResponseTemplate(false, '启动测试成功！'));
    return;
  }
  // 下发启动测试数据指令到主节点
  let bufstr = 'AA55'+'CE'+'06'+'0B' + '00' + param.cycle.toString(16).padStart(4, '0') + '0100' + '0000';
  serialport.write(Buffer.from(bufstr, 'hex'), (err) => {
    if (!err) {
      // 更新程序的主缓存中的测试仪器信息及配置信息
      program.isOnTest = true;
      program.cycle = param.cycle;
      program.isSendding = param.isSendding;
      program.equipments = param.equipments;
      program.IDS = param.IDS;

      res.send(new util.ResponseTemplate(true, '启动测试成功！'));
    } else {
      res.send(new util.ResponseTemplate(false, '串口写入错误，发送启动测试指令失败，请重新操作！！！'));
    }
  });
});

app.get('/systemSync', (req, res) => {
  let response = {
    isOnTest: program.isOnTest,
    cycle: program.cycle,
    isSendding: program.isSendding,
    equipments: program.equipments,
  };
  res.send(response);
});