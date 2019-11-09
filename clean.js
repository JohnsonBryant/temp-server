'use strict';
const fs = require('fs');
const path = require('path');


let clearObjects = [
  // {
  //   path: path.join(__dirname, '/dist'),
  //   type: 'dir',
  // },
  {
    path: path.join(__dirname, '/conf'),
    type: 'dir',
  },
  {
    path: path.join(__dirname, '/log'),
    type: 'dir',
  },
  {
    path: path.join(__dirname, '/data.db'),
    type: 'file',
  },
];

function clear(clearObjects) {
  clearObjects.forEach( function (item, index) {
    if (item.type === 'dir') {
      if (fs.existsSync(item.path)) {
        deleteDirRecursive(item.path);
      } else {
        console.log(`directory ${item.path} does not exists!`);
      }
    } else if (item.type === 'file') {
      if (fs.existsSync(item.path)) {
        fs.unlink(item.path, (err) => {
          if (!err) {
            console.log(`file ${item.path} delete successed!`);
          } else {
            console.log(`file ${item.path} delete failed!`);
            console.log(err);
          }
        });
      } else {
        console.log(`file ${item.path} does not exists!`);        
      }
    }
  });
}

function deleteDirRecursive(dirpath) {
  let fileList = fs.readdirSync(dirpath);
  fileList.forEach((file) => {
    let p = path.resolve(dirpath, file);
    let pinfo = fs.statSync(p);
    if (pinfo.isFile()) {
      fs.unlinkSync(p);
    } else if (pinfo.isDirectory()) {
      deleteDirRecursive(p);
    }
  });

  fs.rmdirSync(dirpath);
}


if (require.main === module) {
  clear(clearObjects);
} else {
  console.log('error! clean.js must be excuted as main file!');
}