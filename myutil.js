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
  directiveMsg: 'directiveMsg',
}

const ioEvent = {
  connection: 'connection',
  connectMsg: 'connectMsg',
  dataMsg: 'dataMsg',
  unconfigedDataMsg: 'unconfigedDataMsg',
  directiveModifyID: 'directiveModifyID',
  directiveSearchSensors: 'directiveSearchSensors',
  // systemMessage: 'systemMessage',
  // directiveStartTest: 'directiveStartTest',
  // directiveStopTest: 'directiveStopTest',
}

const CommonBaudRate = [300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 43000, 56000, 57600, 115200]

function nowtime () 
{
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS')
}

function nowDate () 
{
  return moment().format('YYYY-MM-DD')
}


// 配置程序 json 配置文件路径，及必要时初始化默认配置文件
const confPathList = [
  path.join(__dirname, 'conf'),
  path.join(__dirname, 'conf/config.json'),
  path.join(__dirname, 'conf/testTemplate.json'),
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
      SerialPortName: "COM4",
      BaudRate: 115200,
      BatteryLow: 3.3,
      BatteryHigh: 7.2
    }
  },
  {
    path: confPathList[2],
    type: "json",
    data: {
      cycle: 120,
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

/**
 * HTTP 请求返回结果的模板构造函数
 * @param isSuccess 接收参数类型 bool 值, 标识操作是否成功，默认参数 true
 * @param message 操作提示消息，默认参数为 ''
 * @return 模板的示例对象
 */
function ResponseTemplate(isSuccess = true, message = '') {
  if (new.target !== ResponseTemplate) {
    return new ResponseTemplate();
  }
  this.isSuccess = typeof isSuccess === 'boolean' ? 
    isSuccess : 
    true
  ;
  this.message = typeof message === 'string' ? 
    message : 
    message.toString()
  ;
}

/**
 * 检查参数是否为整数值
 * @param obj 任意类型值
 * @return bool， 表示参数 obj 是否为整数
 */
function isInteger(obj) {
  return typeof obj === 'number' && obj % 1 === 0;
}

/**
 * 检查参数是否为整数值
 * @param obj 任意类型值
 * @return bool， 表示参数 obj 是否为整数
 */
function isPositiveInteger(obj) {
  return typeof obj === 'number' && obj % 1 === 0 && obj > 0;
}

/**
 * 检查参数是否为正数
 * @param obj 应传入数值型, 传入非数值参数一定返回false
 * @return bool， 表示参数 obj 是否为正数
 */
function isPositiveNumber(obj) {
  return typeof obj === 'number' && !isNaN(obj) && obj >= 0;
}


/**
 * 检查参数是否为有效数值
 * @param obj 应传入数值型, 传入非数值参数一定返回false
 * @return bool， 表示参数 obj 是否为有效数值
 */
function isValidNumber(obj) {
  return typeof obj === 'number' && !isNaN(obj);
}

/**
 * @param {*} data 数值数组
 * @return 数组长度为0时，返回 NaN
 */
function Average(data) {
  if (!data instanceof Array) {
    throw new Error('invalid input, param can only be array...');
  }
  let len = data.length;
  if (len === 0) {
    return NaN;
  }
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += 1 * data[i];
  }
  return sum / len;
}

/**
 * @param {*} data 数值数组
 * @return 数组长度为0时，返回 NaN
 */
function Max(data) {
  let arr = Array.prototype.slice.call(data);
  let len = arr.length;
  if (len === 0) {
    return NaN;
  }
  if (len === 1) {
    return arr[0];
  }
  return Math.max.apply(null, arr);
}

/**
 * @param {*} data 数值数组
 * @return 数组长度为0时，返回 NaN
 */
function Min(data) {
  let arr = Array.prototype.slice.call(data);
  let len = arr.length;
  if (len === 0) {
    return NaN;
  }
  if (len === 1) {
    return arr[0];
  }
  return Math.min.apply(null, arr);
}


module.exports = {
  _event,
  AppEvents,
  ioEvent,
  nowtime,
  nowDate,
  initConf,
  confPathList,
  saveJsonToConf,
  ResponseTemplate,
  isInteger,
  isValidNumber,
  isPositiveNumber,
  isPositiveInteger,
  CommonBaudRate,
  Average,
  Min,
  Max,
}