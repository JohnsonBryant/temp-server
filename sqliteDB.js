/**
 * File: sqlite.js.
 * Author: W A P.
 * Email: 610585613@qq.com.
 * Datetime: 2018/07/24.
 */
 
var fs = require('fs');
var sqlite3 = require('sqlite3').verbose();
 
var DB = DB || {};
 
DB.SqliteDB = function(file){
    DB.db = new sqlite3.Database(file);
 
    DB.exist = fs.existsSync(file);
    if(!DB.exist){
        console.log("Creating db file!");
        fs.openSync(file, 'w');
    };

    this.initTable = initDataTable.bind(this)
    this.initTable()
};
 
DB.printErrorInfo = function(err){
    console.log("Error Message:" + err.message + " ErrorNumber:" + errno);
};
 
DB.SqliteDB.prototype.createTable = function(sql){
    DB.db.serialize(function(){
        DB.db.run(sql, function(err){
            if(null != err){
                DB.printErrorInfo(err);
                return;
            }
        });
    });
};
 
/// tilesData format; [[level, column, row, content], [level, column, row, content]]
DB.SqliteDB.prototype.insertData = function(sql, objects){
    DB.db.serialize(function(){
        var stmt = DB.db.prepare(sql);
        for(var i = 0; i < objects.length; ++i){
            stmt.run(objects[i]);
        }
    
        stmt.finalize();
    });
};
 
DB.SqliteDB.prototype.queryData = function(sql, callback){
    DB.db.all(sql, function(err, rows){
        if(null != err){
            DB.printErrorInfo(err);
            return;
        }
 
        /// deal query data.
        if(callback){
            callback(rows);
        }
    });
};
 
DB.SqliteDB.prototype.executeSql = function(sql){
    DB.db.run(sql, function(err){
        if(null != err){
            DB.printErrorInfo(err);
        }
    });
};
 
DB.SqliteDB.prototype.close = function(){
    DB.db.close();
};

// 初始化数据库
function initDataTable() {
    // 创建测试设备表
    let createTableEm = `create table if not exists equipment(
      id INTEGER PRIMARY KEY, company TEXT, em TEXT, deviceName TEXT, deviceType TEXT, deviceID TEXT, insertDate TEXT 
    );`
    
    // 创建测试记录表
    let testRecords = `create table if not exists testRecords(
      id INTEGER PRIMARY KEY, company TEXT, em TEXT, deviceName TEXT, deviceType TEXT, deviceID TEXT, testDate TEXT, cycle INTEGER, temp REAL, humi REAL, centerID INTEGER, IDS TEXT
    );`

    // 创建传感器数据表，表关联： sensorData.test_id = testRecords.id
    let sensorData = `create table if not exists sensorData(
      id INTEGER PRIMARY KEY, sensorID INTERGER, temp REAL, humi REAL, stime TEXT, test_id INTEGER
    );`
    
    // 创建测试数据表（温度、湿度（均匀度、波动度、偏差）），表关联： testData.test_id = testRecords.id
    let testData = `create table if not exists testData(
      id INTEGER PRIMARY KEY, evennessTemp REAL, fluctuationTemp REAL, deviationTemp REAL,
      evennessHumi REAL, fluctuationHumi REAL, deviationHumi REAL, stime TEXT, test_id INTEGER
    );`

    this.createTable(createTableEm)
    this.createTable(testRecords)
    this.createTable(sensorData)
    this.createTable(testData)
  }
  

/// export SqliteDB.
module.exports.SqliteDB = DB.SqliteDB;