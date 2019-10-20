'use strict'
const jsonfile = require('jsonfile')
const path = require('path')
const fs = require('fs')
const moment = require('moment')

const EventEmitter = require('events').EventEmitter
const _event = new EventEmitter()
_event.setMaxListeners(10)

const AppEvents = {
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


function nowtime () 
{
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS')
}


// 配置程序 json 配置文件路径，及必要时初始化默认配置文件
const confPathList = [
  path.join(__dirname, 'conf'),
  path.join(__dirname, 'conf/config.json'),
  path.join(__dirname, 'conf/testTemplate.json')
]
const confList = [
  {
    path: confPathList[0],
    type: "dir",
    data: null
  },
  {
    path: confPathList[1],
    type: "json",
    data: {
      SerialPortName: "COM10",
      BaudRate: 115200,
      BatteryLow: 2.8,
      BatteryHigh: 3.5
    }
  },
  {
    path: confPathList[2],
    type: "json",
    data: {
      cycle: 10,
      temp: 20,
      humi: 50,
      centerID: 1,
      IDS: "2,3",
      isSendding: true
    } 
  }  
]

// 目录及配置文件初始化检查
function initConf() {  
  confList.forEach((conf) => {
    if (conf.type === 'dir')
    {
      if ( !fs.existsSync(conf.path) ) {
        fs.mkdirSync(conf.path)
      }
    }
    else if (conf.type === 'json') 
    {
      if (!fs.existsSync(conf.path)) {
        jsonfile.writeFileSync(conf.path, conf.data)
      }
    }
  })
}

function saveJsonToConf(objInput, filePath) {
  let ret = true
  // 读取配置文件，获取当前配置信息的 JSON对象
  if (!fs.existsSync(filePath)) {
    ret = false
    return
  }
  let confOrigin = jsonfile.readFileSync(filePath)
  // 遍历入参对象，更新当前配置信息的 JSON对象
  Object.keys(objInput).forEach((key) => {
    confOrigin[key] = objInput[key]
  })
  // 保存新的配置信息的 JSON对象到文件
  jsonfile.writeFileSync(filePath, confOrigin)
  return ret
}

module.exports = {
  _event,
  AppEvents,
  ioEvent,
  nowtime,
  initConf,
  confPathList,
  saveJsonToConf
}