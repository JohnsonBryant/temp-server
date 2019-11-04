'use strict'
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
let buf = Buffer.alloc(0); // main data buffer
let program = {
  isOnTest: false,
  cycle: '',
  isSendding: true,
  equipments: [
    // {
    //   device: {
    //     company: '',
    //     em: '',
    //     deviceName: '',
    //     deviceType: '',
    //     deviceID: '',
    //   },
    //   config: {
    //     temp: '',
    //     humi: '',
    //     centerID: '',
    //     IDS: '',
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
  serialport.write(`Open serialport ${Config.SerialPortName} successed!`);
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

  let bufLen = buf.length + data.length;
  buf = Buffer.concat([buf, data], bufLen);

  processbuf();
})
// 串口数据校验处理
const processbuf = function () {
  let idx = buf.indexOf(Buffer.from('AA55', 'hex'));
  if (idx === -1) {
    buf = Buffer.alloc(0);
    return;
  }

  while (true) {
    if (buf.length < Packet.minlen) {
      break;
    }

    let packlen = buf.readUInt8(idx + 3) + Packet.minlen;
    if(buf.length < packlen){
      break;
    }

    let packbuf = Buffer.alloc(packlen);
    buf.copy(packbuf, 0, idx, idx + packlen);

    util._event.emit(util.AppEvents.parse, packbuf);

    let remainlen = buf.length - packlen - idx;
    let remainbuf = Buffer.alloc(remainlen);
    buf.copy(remainbuf, 0, idx + packlen, buf.length);
    buf = remainbuf;

    idx = buf.indexOf(Buffer.from('AA55', 'hex'));
  }
};
// 串口数据解析，通过事件分发到其他处理过程
util._event.on(util.AppEvents.parse, (packbuf) => {
  if (packbuf.readUInt8(2) === 0xD1) {
    // 接收到传感器数据
    let DataPack = Packet.DataPackParser.parse(packbuf);
    // 系统是否在测试中，传感器ID是否对应测试中的某个仪器，
    util._event.emit(util.AppEvents.dataMsg, DataPack);
  } else {
    // 传感器指令
    let DirectivePack = Packet.DirectivePackParser.parse(packbuf);

    util._event.emit(util.AppEvents.directiveMsg, DirectivePack);
  }
})

// 添加路由中间件，解析JSON、 encoded 数据
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
// webserver
app.use('/', express.static(path.join(__dirname, '../client/dist')));
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
  // 接收到前端请求后，解析打包数据(构建为约定的数据格式)，调用串口发送数据到主节点
  let idSetting = {
    originID: req.body.originID,
    newID: req.body.newID
  };

  res.send({"isSuccessed": true});
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
  sqliteDB.queryData(`select distinct company from equipment where company like %${req.body.company}%;`, (rows) => {
    res.send(rows);
  });
});

// 获取最近五条测试设备数据接口
app.get('/lastestFiveTestEq', (req, res) => {
  // 接收到前端请求后，从数据表（测试设备）中，查询最近插入的五条测试设备信息，返回给前端
  sqliteDB.queryData('select * from equipment order by insertDate desc limit 5;', (rows) => {
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
  let result = {'isSuccessed': true, errorMessage: '', errorEquipmentInfo: []};
  equipmentInfos.forEach((item) => {  
    let equipmentInfo = [item];
    let insertResult = sqliteDB.insertData('insert into equipment(company, em, deviceName, deviceType, deviceID, insertDate) values (?, ?, ?, ?, ?, ?);', equipmentInfo);
    if (!insertResult) {
      result['isSuccessed'] = false;
      result['errorMessage'] = '设备已经添加到系统，请勿重复添加！';
      result['errorEquipmentInfo'].push();
    }
  });
  res.send(result);
});


// websocket server 客户端连接事件，下发连接成功提示到客户端
io.on(util.ioEvent.connection, (socket) => {
  io.emit(util.ioEvent.connectMsg, `you have connectted with websocket server, please waiting for message update!`);
});
// 自定义event对象绑定事件， 下发传感器数据消息 到客户端
util._event.on(util.AppEvents.dataMsg, (pack) => {
  io.emit(util.ioEvent.dataMsg, pack);
});
// 自定义event对象绑定事件， 下发传感器指令消息 到客户端
util._event.on(util.AppEvents.directiveMsg, (pack) => {
  // 不同应答类型的分支处理，定义并封装适合的应答JSON格式，由 io.emit 推送到前端。
  directiveAction(pack.command.toString(16));
});

function directiveAction(command) {
  let commands = {
    'DD': function () {
      /* 成功启动使主节点周期获取数据动作，开始测试 / 继续测试
      * 更新当前系统是否在测试状态变量
      */
      io.emit(util.ioEvent.directiveStartTest, pack);

    },
    'CE': function () {
      /* 成功停止主节点周期获取数据动作，停止测试 / 暂停测试
      * 更新当前系统是否在测试状态变量
      */
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