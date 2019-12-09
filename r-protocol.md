# 前后端程序 数据交换格式约定

* server.program 参数格式
```javascript
  // 后端程序 主数据对象
  let program = {
    buf: Buffer.alloc(0),
    isOnTest: Boolean,
    cycle: Number,
    isSendding: Boolean,
    IDS: [Number],
    cache: {
      '1': {temp: Number, humi: Number, batt: Number},
      '2': {temp: Number, humi: Number, batt: Number},
    },
    equipments: [
      {
        device: {
          company: String,
          em: String,
          deviceName: String,
          deviceType: String,
          deviceID: String,
          id: Number,
        },
        config: {
          temp: Number,
          humi: Number,
          centerID: Number,
          IDS: [Number],
        },
        data: {
          'IDS': [Number],
          '1': {
            'temp': [Number],
            'humi': [Number],
            'batt': [Number],
          },
          '2': {
            'temp': [Number],
            'humi': [Number],
            'batt': [Number],
          },
          '3': {
            'temp': [Number],
            'humi': [Number],
            'batt': [Number],
          },
          'evennessTemp': [Number],  // 均匀度
          'fluctuationTemp': [Number],  // 波动度
          'deviationTemp': [Number],  // 偏差
          'evennessHumi': [Number],
          'fluctuationHumi': [Number],
          'deviationHumi': [Number],
          'time': [String],
        }
      }
    ],
  };
```

```javascript
// 实时监测页， 测试仪器下挂载的传感器实时图标对象模板
const template = {
  title: {
    text: '', // 根据数据生成 ， 曲线数据类型 温度、湿度
    textStyle: {
      fontSize: 16,
    }
  },
  tooltip: {
    trigger: 'axis',
  },
  legend: {
    left: 35,
    textStyle: {
      fontSize: 14,
    },
    data:[], // 根据数据生成， 对应曲线图标题数组
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true,
  },
  toolbox: {
    // feature: {
    //   saveAsImage: {}
    // }
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: [],  // 根据数据生成， 数据时间数组， 对应曲线图的 X 轴
  },
  yAxis: {
    type: 'value',
  },
  series: [
    {
      name:'ID1', // 根据数据生成， 传感器ID
      type:'line',
      stack: '总量',
      data:[], // 传感器数据
    },
  ]
};

// 实时监测页 实时展示的测试仪器数据对象
const deviceTestData = [
  {
    equipment: {
      company: '南京高华科技股份有限公司',
      em: '南京高华',
      deviceName: '温湿度检测仪',
      deviceType: 'GH-100',
      deviceID: '01-001',
      id: 1,
    },
    updateTime: '',
    testData: [
      {name:'1'+'-电量100%', tempData: 22.22, humiData: 33.33},
      {name:'2'+'-电量100%', tempData: 22.22, humiData: 33.33},
      {name:'3'+'-电量100%', tempData: 22.22, humiData: 33.33},
      {name:'4'+'-电量100%', tempData: 22.22, humiData: 33.33},
      {name:'均匀度：', tempData: 22.22, humiData: 33.33},
      {name:'波动度：', tempData: 22.22, humiData: 33.33},
      {name:'偏差：', tempData: 22.22, humiData: 33.33}
    ],
    temps: {
      title: {
        text: '温度',
        textStyle: {
          fontSize: 16
        }
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        left: 35,
        textStyle: {
          fontSize: 14,
        },
        data:['ID1','ID2','ID3','ID4','ID5',]
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      toolbox: {
        // feature: {
        //   saveAsImage: {}
        // }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: ['10:01','10:02','10:03','10:04','10:05','10:06','10:07']
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name:'ID1',
          type:'line',
          stack: '总量',
          data:[120, 132, 101, 134, 90, 230, 210]
        },
        {
          name:'ID2',
          type:'line',
          stack: '总量',
          data:[220, 182, 191, 234, 290, 330, 310]
        },
        {
          name:'ID3',
          type:'line',
          stack: '总量',
          data:[150, 232, 201, 154, 190, 330, 410]
        },
        {
          name:'ID4',
          type:'line',
          stack: '总量',
          data:[320, 332, 301, 334, 390, 330, 320]
        },
        {
          name:'ID5',
          type:'line',
          stack: '总量',
          data:[820, 932, 901, 934, 1290, 1330, 1320]
        },
      ]
    },
    humis: {
      title: {
        text: '湿度',
        textStyle: {
          fontSize: 16
        }
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        left: 35,
        textStyle: {
          fontSize: 14,
        },
        data:['ID1','ID2','ID3','ID4','ID5']
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      toolbox: {
        // feature: {
        //   saveAsImage: {}
        // }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: ['10:01','10:02','10:03','10:04','10:05','10:06','10:07']
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name:'ID1',
          type:'line',
          stack: '总量',
          data:[120, 132, 101, 134, 90, 230, 210]
        },
        {
          name:'ID2',
          type:'line',
          stack: '总量',
          data:[220, 182, 191, 234, 290, 330, 310]
        },
        {
          name:'ID3',
          type:'line',
          stack: '总量',
          data:[150, 232, 201, 154, 190, 330, 410]
        },
        {
          name:'ID4',
          type:'line',
          stack: '总量',
          data:[320, 332, 301, 334, 390, 330, 320]
        },
        {
          name:'ID5',
          type:'line',
          stack: '总量',
          data:[820, 932, 901, 934, 1290, 1330, 1320]
        }
      ]
    }
  }
]

```
