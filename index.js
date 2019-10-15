'use strict'
const fs = require('fs')
const path = require('path')
// http server , websocket server
const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)

let SqliteDB = require('./sqliteDB').SqliteDB
let sqliteDB = new SqliteDB(path.join(__dirname, 'data.db'))

const myutil = require('./myutil')
const Packet = require('./packetParser.js')

const EventEmitter = require('events').EventEmitter
const _event = new EventEmitter()
_event.setMaxListeners(10)

const Events = {
  parse: 'parse',
  dataMsg: 'dataMsg',
  directiveMsg: 'directiveMsg'
}

const ioEvent = {
  connection: 'connection',
  connectMsg: 'connectMsg',
  dataMsg: 'dataMsg',
  directiveMsg: 'directiveMsg'
}

// 目录及配置文件初始化检查
function initDirectory(_fs, _path, dirname) {
  // 检查 conf 目录是否存在，不存在，则创建 conf 目录，用于存放程序相关的 json 配置文件
  let dirConf = _path.join(dirname, 'conf')
  if ( !_fs.existsSync(dirConf) ) {
    _fs.mkdirSync(dirConf)
  }
  // 检查所有的 json 配置文件

}
initDirectory(fs, path, __dirname)

const Config = require('./conf/config.json')
const PortName = Config.SerialPortName
const BaudRate = parseInt(Config.BaudRate)
const SerialPort = require('serialport')


// 串口
let buf = Buffer.alloc(0)
const serialport = new SerialPort(PortName, {
  baudRate: BaudRate
})
// 打开串口
serialport.open(() => {
  serialport.write(`Open serialport ${PortName} successed!`)
})
// 串口错误
serialport.on('error', (message) => {
  console.log(myutil.nowtime(), message)
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
      _event.emit(Events.parse, packbuf)
    // }

    let remainlen = buf.length - packlen - idx
    let remainbuf = Buffer.alloc(remainlen)
    buf.copy(remainbuf, 0, idx + packlen, buf.length)
    buf = remainbuf

    idx = buf.indexOf(Buffer.from('AA55', 'hex'))
  }
}
// 串口数据解析，通过事件分发到其他处理过程
_event.on(Events.parse, (packbuf) => {
  if (packbuf.readUInt8(2) === 0xD1) {
    // 传感器数据
    let DataPack = Packet.DataPackParser.parse(packbuf)
    
    _event.emit(Events.dataMsg, DataPack)
  }
  else {
    // 传感器指令
    let DirectivePack = Packet.DirectivePackParser.parse(packbuf)

    _event.emit(Events.directiveMsg, DirectivePack)
  }
})

// webserver
app.use('/', express.static(path.join(__dirname, '../client/dist')))
// 首页 index.html
app.get('/', (req, res) => {
  res.sendFile('/index.html')
})
// HTTP 侦听
http.listen(8080, () => {
  let host = http.address().address
  let port = http.address().port
  console.log(myutil.nowtime(), `webserver listening at ${host}:${port}`)
})
// websocket server 连接事件
io.on(ioEvent.connection, (socket) => {
  io.emit(ioEvent.connectMsg, `you have connectted with websocket server, please waiting for message update!`)
})
// 上报传感器数据消息 到websocket客户端
_event.on(Events.dataMsg, (pack) => {
  io.emit(ioEvent.dataMsg, pack)
})
// 上报传感器指令消息 到websocket客户端
_event.on(Events.directiveMsg, (pack) => {
  io.emit(ioEvent.directiveMsg, pack)
})