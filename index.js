'use strict'
const fs = require('fs')
const path = require('path')
const jsonfile = require('jsonfile')
const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const bodyParser = require('body-parser')
const SerialPort = require('serialport')
let SqliteDB = require('./sqliteDB').SqliteDB

const util = require('./myutil.js') // 程序关键配置参数，功能函数，初始化函数
const Packet = require('./packetParser.js') // 数据解析模板
const sqliteDB = new SqliteDB(path.join(__dirname, 'data.db')) // 数据对象，封装必要功能函数

util.initConf() // 程序配置目录及文件初始化检查 / 生成
let Config = require('./conf/config.json')


// 串口
let buf = Buffer.alloc(0)
const serialport = new SerialPort(Config.SerialPortName, {
  baudRate: parseInt(Config.BaudRate)
})
// 打开串口
serialport.open(() => {
  serialport.write(`Open serialport ${Config.SerialPortName} successed!`)
})
// 串口错误
serialport.on('error', (message) => {
  console.log(util.nowtime(), message)
})
// 串口数据接收
serialport.on('data', (data) => {
  if (!data) {
    return
  }

  let bufLen = buf.length + data.length
  buf = Buffer.concat([buf, data], bufLen)

  processbuf()
})
// 串口数据校验处理
const processbuf = function () {
  let idx = buf.indexOf(Buffer.from('AA55', 'hex'))
  if (idx === -1) {
    buf = Buffer.alloc(0)
    return
  }

  while (true) {
    if (buf.length < Packet.minlen) {
      break;
    }

    let packlen = buf.readUInt8(idx + 3) + Packet.minlen
    if(buf.length < packlen){
      break
    }

    let packbuf = Buffer.alloc(packlen)
    buf.copy(packbuf, 0, idx, idx + packlen)

    // let  checksum = 0
    // for (let i = 0; i < packlen - 2; i++) {
    //   checksum += packbuf[i]
    // }

    // if (checksum === packbuf.readUInt16BE(packlen - 2)) {
      util._event.emit(util.AppEvents.parse, packbuf)
    // }

    let remainlen = buf.length - packlen - idx
    let remainbuf = Buffer.alloc(remainlen)
    buf.copy(remainbuf, 0, idx + packlen, buf.length)
    buf = remainbuf

    idx = buf.indexOf(Buffer.from('AA55', 'hex'))
  }
}
// 串口数据解析，通过事件分发到其他处理过程
util._event.on(util.AppEvents.parse, (packbuf) => {
  if (packbuf.readUInt8(2) === 0xD1) {
    // 传感器数据
    let DataPack = Packet.DataPackParser.parse(packbuf)
    
    util._event.emit(util.AppEvents.dataMsg, DataPack)
  }
  else {
    // 传感器指令
    let DirectivePack = Packet.DirectivePackParser.parse(packbuf)

    util._event.emit(util.AppEvents.directiveMsg, DirectivePack)
  }
})

// 添加路由中间件，解析JSON、 encoded 数据
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
// webserver
app.use('/', express.static(path.join(__dirname, '../client/dist')))
// HTTP 侦听
http.listen(8080, () => {
  let host = http.address().address
  let port = http.address().port
  console.log(util.nowtime(), `webserver listening at ${host}:${port}`)
})

// 路由到 index.html
app.get('/', (req, res) => {
  res.sendFile('/index.html')
})

// 获取配置信息（串口参数、电池参数） 接口
app.get('/config/get', function (req, res) {
  let config = jsonfile.readFileSync(util.confPathList[1])
  res.send({
    SerialPortName: config.SerialPortName ,
    BaudRate: parseInt(config.BaudRate),
    BatteryLow: parseFloat(config.BatteryLow),
    BatteryHigh: parseFloat(config.BatteryHigh),
  })
});
// 修改串口配置信息 接口
app.post('/serialportConf/set', function (req, res) {
  // 数据检查
  
  let confRecv = {
    SerialPortName: req.body.SerialPortName,
    BaudRate: parseInt(req.body.BaudRate)
  }
  // 保存到配置文件 conf/config.json
  let result = util.saveJsonToConf(confRecv, util.confPathList[1])
  let response = {"isSuccessed": result}
  res.send(response)
});
// 修改电池电量参数 接口
app.post('/batteryConf/set', function (req, res) {
  // 数据检查
  
  let confRecv = {
    BatteryLow: parseFloat(req.body.BatteryLow),
    BatteryHigh: parseFloat(req.body.BatteryHigh)
  }
  // 保存到配置文件 conf/config.json
  let result = util.saveJsonToConf(confRecv, util.confPathList[1])
  let response = {"isSuccessed": result}
  res.send(response)
});
// 获取测试模板信息 接口
app.get('/testTemplate/get', function (req, res) {
  let testTemplate = jsonfile.readFileSync(util.confPathList[2])
  res.send({
    cycle: parseInt(testTemplate.cycle),
    temp: parseFloat(testTemplate.temp),
    humi: parseFloat(testTemplate.humi),
    centerID: parseInt(testTemplate.centerID),
    IDS: testTemplate.IDS,
  })
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
  }
  // 保存到配置文件 conf/config.json
  let result = util.saveJsonToConf(confRecv, util.confPathList[2])
  let response = {"isSuccessed": result}
  res.send(response)
});
// 搜索传感器 接口
app.get('/searchSensor', (req, res) => {
  // 数据检查
  
  // 接收到前端请求后，调用串口发送数据到主节点(确认数据包格式)

  res.send({"isSuccessed": true})
})
// 修改传感器ID
app.post('/idSet', (req, res) => {
  // 接收到前端请求后，解析打包数据(构建为约定的数据格式)，调用串口发送数据到主节点
  let idSetting = {
    originID: req.body.originID,
    newID: req.body.newID
  }

  res.send({"isSuccessed": true})
})



// websocket server 客户端连接事件，下发连接成功提示到客户端
io.on(util.ioEvent.connection, (socket) => {
  io.emit(util.ioEvent.connectMsg, `you have connectted with websocket server, please waiting for message update!`)
})
// 自定义event对象绑定事件， 下发传感器数据消息 到客户端
util._event.on(util.AppEvents.dataMsg, (pack) => {
  io.emit(util.ioEvent.dataMsg, pack)
})
// 自定义event对象绑定事件， 下发传感器指令消息 到客户端
util._event.on(util.AppEvents.directiveMsg, (pack) => {
  io.emit(util.ioEvent.directiveMsg, pack)
})