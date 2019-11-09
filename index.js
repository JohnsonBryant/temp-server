'use strict';
const fs = require('fs');
const path = require('path');
const jsonfile = require('jsonfile');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const SerialPort = require('serialport');
const { Console } = require('console');
const util = require('./myutil.js'); // 程序关键配置参数，功能函数，初始化函数
let SqliteDB = require('./sqliteDB').SqliteDB;
const Packet = require('./packetParser.js'); // 数据解析模板

util.initConf(); // 程序配置目录及文件初始化检查 / 生成
// 全局参数变量
const output = fs.createWriteStream(path.join(__dirname, `log/log${util.nowDate()}.log`));
const errOutput = fs.createWriteStream(path.join(__dirname, `log/errLog${util.nowDate()}.log`));
const loger = new Console({stdout: output, stderr: errOutput});
const sqliteDB = new SqliteDB(path.join(__dirname, 'data.db')); // 数据库对象，封装必要功能函数
const app = express(); // express app object
const httpServer = http.Server(app); // http server
const io = socketIo(httpServer); // websocket server
const Config = require('./conf/config.json'); // main config of program
// let buf = Buffer.alloc(0); // main data buffer
let program = {
  buf: Buffer.alloc(0),
  isOnTest: false,
  cycle: 10,
  isSendding: true,
  equipments: [
    // {
    //   device: {
    //     company: '南京高华科技股份有限公司',
    //     em: '南京高华',
    //     deviceName: '温湿度传感器',
    //     deviceType: 'wx01',
    //     deviceID: '0001',
    //   },
    //   config: {
    //     temp: 22.2,
    //     humi: 55.5,
    //     centerID: 2,
    //     IDS: [1,3],
    //   }
    // }
  ]
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
  loger.error(util.nowtime(), message);
});
// 串口数据接收
serialport.on('data', (data) => {
  if (!data) {
    return;
  }

  let bufLen = program.buf.length + data.length;
  program.buf = Buffer.concat([program.buf, data], bufLen);

  processbuf();
})
// 串口数据校验处理
const processbuf = function () {
  let idx = program.buf.indexOf(Buffer.from('AA55', 'hex'));
  if (idx === -1) {
    program.buf = Buffer.alloc(0);
    return;
  }

  while (true) {
    if (program.buf.length < Packet.minlen) {
      break;
    }

    let packlen = program.buf.readUInt8(idx + 3) + Packet.minlen;
    if(program.buf.length < packlen){
      break;
    }

    let packbuf = Buffer.alloc(packlen);
    program.buf.copy(packbuf, 0, idx, idx + packlen);

    util._event.emit(util.AppEvents.parse, packbuf);

    let remainlen = program.buf.length - packlen - idx;
    let remainbuf = Buffer.alloc(remainlen);
    program.buf.copy(remainbuf, 0, idx + packlen, program.buf.length);
    program.buf = remainbuf;

    idx = program.buf.indexOf(Buffer.from('AA55', 'hex'));
  }
};

// 串口数据解析，通过事件分发到其他处理过程
util._event.on(util.AppEvents.parse, (packbuf) => {
  if (packbuf.readUInt8(2) === 0xD1) {
    // 接收到传感器数据
    let DataPack = Packet.DataPackParser.parse(packbuf);

    // 处理传感器数据，与测试仪器绑定

    // 系统是否在测试中，传感器ID是否对应测试中的某个仪器，
    
    // 触发数据消息事件，交由 io ，传送单个传感器数据包到前端
    util._event.emit(util.AppEvents.dataMsg, DataPack);
  } else {
    // 传感器指令解析
    let DirectivePack = Packet.DirectivePackParser.parse(packbuf);
    // 触发数据指令事件，交由 io 对象，传送数据指令消息到前端用户
    // util._event.emit(util.AppEvents.directiveMsg, DirectivePack);
    directiveAction(io, DirectivePack);
  }
})

// 自定义event对象绑定事件， 下发传感器数据消息 到客户端
util._event.on(util.AppEvents.dataMsg, (pack) => {
  io.emit(util.ioEvent.dataMsg, pack);
});

// // 自定义event对象绑定事件， 下发传感器指令消息 到客户端
// util._event.on(util.AppEvents.directiveMsg, (pack) => {
//   // 不同应答类型的分支处理，定义并封装适合的应答JSON格式，由 io.emit 推送到前端。

// });


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
  loger.log(util.nowtime(), `webserver listening at ${host}:${port}`);
});

// 路由到 index.html
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
  // 数据检查
  
  let confRecv = {
    SerialPortName: req.body.SerialPortName,
    BaudRate: parseInt(req.body.BaudRate)
  };
  // 保存到配置文件 conf/config.json
  let result = util.saveJsonToConf(confRecv, util.confPathList[1]);
  let response = {"isSuccessed": result};
  res.send(response);
});

// 修改电池电量参数 接口
app.post('/batteryConf/set', function (req, res) {
  // 数据检查
  
  let confRecv = {
    BatteryLow: parseFloat(req.body.BatteryLow),
    BatteryHigh: parseFloat(req.body.BatteryHigh)
  };
  // 保存到配置文件 conf/config.json
  let result = util.saveJsonToConf(confRecv, util.confPathList[1]);
  let response = {"isSuccessed": result};
  res.send(response);
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
  // 数据检查
  
  let confRecv = {
    cycle: parseInt(req.body.cycle) ,
    temp: parseFloat(req.body.temp),
    humi: parseFloat(req.body.humi),
    centerID: parseInt(req.body.centerID),
    IDS: req.body.IDS,
    isSendding: req.body.isSendding,
  };
  // 保存到配置文件 conf/config.json
  let result = util.saveJsonToConf(confRecv, util.confPathList[2]);
  let response = {"isSuccessed": result};
  res.send(response);
});

// 搜索传感器 接口
app.get('/searchSensor', (req, res) => {
  // 数据检查
  
  // 接收到前端请求后，调用串口发送数据到主节点(确认数据包格式)
  
  res.send({"isSuccessed": true});
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
  // 接收到前端请求后，解析打包数据(构建为约定的数据格式)，将测试设备信息存储到测试设备表中
  // 单条记录写入 / 多条记录批量写入
  let equipmentInfos = [];
  req.body.forEach((item) => {
    equipmentInfos.push([item.company,
      item.em,
      item.deviceName,
      item.deviceType,
      item.deviceID,
      item.insertDate
    ]);
  });

  // 数据写入结果的监测，及返回结果的调整
  let result = new util.ResponseTemplate(true);
  try {
    equipmentInfos.forEach((item) => {
      sqliteDB.insertData('insert into equipment(company, em, deviceName, deviceType, deviceID, insertDate) values (?, ?, ?, ?, ?, ?);', [item]);
    });
  } catch {
    result.isSuccessed = false;
  }
  res.send(result);
});

// 删除单个测试设备数据接口
app.post('/deleteEquipment', (req, res) => {
  // 检查接收参数的正确性
  if (req.body === undefined || req.body.id === undefined) {
    res.send(new util.ResponseTemplate(false, '操作无效，请按F5刷新后，重新操作！'));
    return;
  }
  let sql = `delete from equipment where id=${req.body.id};`;
  console.log(req.body);
  sqliteDB.executeSql(sql);
  res.send(new util.ResponseTemplate(true, '仪器删除成功！'));
});

// 停止测试接口
app.get('/stopTest', (req, res) => {
  let buf = Buffer.from('AA55CE060B00000000000000', 'hex');
  serialport.write(buf, (err) => {
    if (!err) {
      res.send(new util.ResponseTemplate(true, '发送停止测试指令成功！'));
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
  if ( !util.isInteger(param.cycle) || param.cycle < 1) {
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

  // 更新程序的主缓存中的测试仪器信息及配置信息
  program.cycle = param.cycle;
  program.isSendding = param.isSendding;
  program.equipments = param.equipments
  // 判断是否通过串口下发启动测试数据指令到主节点
  if (!program.isSendding) {
    res.send(new util.ResponseTemplate(false, '启动测试成功！'));
    return;
  }
  // 下发启动测试数据指令到主节点
  let bufstr = 'AA55CE060B' + '00' + program.cycle.toString(16).padStart(4, '0') + '0100' + '0000';
  serialport.write(Buffer.from(bufstr, 'hex'), (err) => {
    if (!err) {
      res.send(new util.ResponseTemplate(true, '发送启动测试指令成功！'));
    } else {
      res.send(new util.ResponseTemplate(false, '串口写入错误，发送启动测试指令失败，请重新操作！！！'));
    }
  });
});


// websocket server 客户端连接事件，下发连接成功提示到客户端
io.on(util.ioEvent.connection, (socket) => {
  io.emit(util.ioEvent.connectMsg, `you have connectted with websocket server, please waiting for message update!`);
});


function directiveAction(io, pack) {
  let command = pack.command.toString(16);
  let commands = {
    'DD': function () {
      /* 成功启动使主节点周期获取数据动作，开始测试 / 继续测试
      * 更新当前系统是否在测试状态变量
      */
      program.isOnTest = true;
      io.emit(util.ioEvent.directiveStartTest, pack);
    },
    'CE': function () {
      /* 成功停止主节点周期获取数据动作，停止测试 / 暂停测试
      * 更新当前系统是否在测试状态变量
      */
      program.isOnTest = false;
      io.emit(util.ioEvent.directiveStopTest, pack);
    },
    'A0': function () {
      // 成功修改传感器 ID，推送数据对象到前端
      io.emit(util.ioEvent.directiveModifyID, pack);
    },
    'A1': function () {
      // 搜索传感器应答数据，推送数据对象到前端，可获取到单个在线的传感器ID号
      io.emit(util.ioEvent.directiveSearchSensors, pack);
    },
  };

  if (typeof commands[command] !== 'function') {
    loger.log('无效的数据指令字节 ' + command + ' !!!');
  }

  commands[command]();
}