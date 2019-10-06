'use strict'

const moment = require('moment')

function nowtime () 
{
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS')
}

module.exports = {
  nowtime
}