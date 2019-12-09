# 开发日志

## 开发/运行环境说明
  * 说明
    * 程序部分依赖在 npm install 时，存在 pre-build， pre-build 与机器本身的nodejs 、Python 、visual stuido 环境存在依赖关系。
    * 故必须保证运行环境与开发环境在以下说明部分保持一致。
  * `开发环境`
    * nodejs --version 10.8.0 x86 
    * python 2.7.5  python 3.7.3 同时安装
    * 包管理工具: `yarn` 
  * `运行环境`
    * 后端程序 nodejs --version 10.8.0 x86
    * 前端 `谷歌浏览器` / `electron 应用`

```bash
npm i binary-parser body-parser express jsonfile moment socket.io

cnpm install sqlite3 --node-sqlite3_binary_host_mirror=https://npm.taobao.org/mirrors/ --log-level info
```

## Client 程序

### 前端 Vue 组件说明
  * pages/AddEquipment  新增仪器
  * pages/Dashboard  实时监测
  * pages/LandingPage 设备管理
  * pages/TestConfig  测试配置
  * pages/Workspace 功能配置  

### Client 已实现
  * `设备管理页`
    * 委托单位搜索框功能重新设计及实现
      * 当前设计为， 点击enter 或搜索框失去焦点时，根据搜索框内容查找匹配的五条仪器信息
        * 已编码实现，自测试通过。
        * 可继续调整优化功能逻辑
    * `单个仪器设备的删除`
      * 成功删除设备后， 从页面显示仪器中，删除对应的仪器设备
      * 编码实现，自测试通过
    * `控件状态控制`：测试状态禁用，非测试状态启用
      * 编码实现，自测试通过
    * `选择仪器`
      * 仪器不允许重复选择
        * 编码实现， 自测试通过
    * `点击清空选择`时，如当前已选择为空，则不执行任何操作
      * 编码实现，自测试通过
    * `点击进入测试`时，检查是否已选择设备，如选择设备为空，不进入测试管理页（测试准备状态）
      * 编码实现，自测试通过
    * 测试管理页，由设备管理页选择设备后，进入测试管理后，再切换回设备管理页时，`已选择设备应该始终存在`。
      * 编码实现，自测试通过
    * 点击进入测试，进入测试管理页时，`切换侧边导航的选中项为测试管理`
      * 已实现，自测试通过
      
  * `新增仪器页`
    * 控件状态控制：测试状态禁用，非测试状态启用
      * 编码实现，自测试通过
    * 单个仪器新增功能实现
      * 自测试通过
  
  * `测试管理页`
    * `控件状态控制`: 
      * 测试状态禁用，非测试状态启用
      * 控件状态的初始化
      * 编码实现，自测试通过
    * `停止测试按钮`功能的实现
      * 编码实现，自测试通过
    * `启动测试按钮`功能的实现
      * 测试仪器数至少为1，当测试仪器数据小于1时，点击启动测试无效，并提示用户！
      * 启动测试前的测试仪器配置检查，重点检查传感器ID是否有重复及错误
      * 测试仪器数据格式的构建，传感器ID的转换
      * 编码实现，自测试通过
      * 编码实现，自测试通过
    * `测试状态下，主功能区顶部控制区块的控件状态控制`
      * 编码实现，自测试通过
    * `一键配置` : 多个 / 单个仪器
      * 自测试通过
    * `测试管理页获取测试设备的数据源`，更改为 `store`, `而非路由传递`，避免网页刷新，导致的测试设备数据无法获取问题。
      * 编码实现，自测试通过
    * `测试状态、非测试状态`（设备管理页选择设备路由到测试管理页、其他方式路由到测试管理页）等不同状态下的`页面初始化处理`
    * 测试管理页，由设备管理页选择设备后，进入测试管理后，再切换回设备管理页时，已选择设备应该始终存在。
      * 编码实现，自测试通过

  * **`实时监测页`**


  * `功能配置页`
    * `功能配置页所有功能的启用状态`，与当前系统是否在测试状态进行绑定， 系统在测试状态，禁用所有配置控件，仅可查看当前配置。
      * 编码实现， 自测试通过。
    * `串口参数配置`
      * 编码实现， 简单自测试
      * 波特率必须为正整数， 且必须为后端指定的波特率数组内的值。
    * `电池参数配置`
      * 编码实现， 自测试通过
      * 电池参数， 后端检查，必须为正数， 且最低值一定小于最大值。
    * `传感器ID修改`
      * 编码实现， 自测试通过
      * 传感器ID修改功能完整实现，特殊情况：当原ID与预设ID相等时，默认后端直接返回成功提示，不向主节点发送数据指令。
    * `搜索传感器配置`
      * 编码实现， 数据指令的下发部分功能， 自测试通过
      * 搜索传感器的显示方式更改， websocket 传输到前端的为包含单个传感器ID数据包
        * 编码实现， `未进行功能自测试`。
    * `测试模板配置`
      * 测试模板IDS转换为数值数组后，再传输至后端处理程序
        * IDS 前端使用正则检查， 仅接受输入 数值 "," "，"
      * ID检查， 必须接受 0-255 之间的数值
      * 数据的准确性检查交给后端程序处理
      * 编码实现， 自测试通过


### Client 未实现
  * 设备管理页
      
  * `新增仪器页`
    * 是否输入多个相同仪器检查部分仍然存在漏洞!
    * 单个仪器信息输入组件的校验检查问题。 ref 存在问题
    * 同时提交新增多个仪器功能逻辑， 前端待更改

  * `测试管理页`
    * 测试配置输入框的校验

  * `实时监测页`
    * 测试状态，非测试状态的页面控制
    * 数据下载功能未实现
      * 保存测试数据的 excel 文件到指定目录
      * 保存实时数据的曲线截图到指定目录
    * 测试设备信息同步到实时监测页
    * 实时测试数据更新到页面显示
  
  * `功能配置页`
  
  * `其他`
    * 

## Server 程序

### Server 已实现
  - 设备管理页
    - 删除单个已录入的测试设备
      - 已实现， 自测试通过
    - 获取最近录入的5条测试设备信息
      已实现，自测试通过

  - 新增仪器页
    - 写入仪器信息到数据库
      - 编码实现，自测试通过

  - 测试管理页
    * 停止测试接口 / 启动测试接口
      * 不验证启动与停止测试的返回数据，下发指令即认为操作成功！
    - 停止测试接口
      - 编码实现，数据指令的命令字节正确性待确认（协议不确定）
    - 启动测试接口
      - 是否周期发送控制，根据前端测试管理页对应的启动测试接口传回的数据中对应项：
        - 是否周期获取项为 true，则程序下发启动采集指令给主节点，实现主节点下发周期获取功能。
        - 是否周期获取项为 false，则程序不下发启动采集指令给主节点，仅作为数据接收设备，由其他同时在测试的设备主节点周期下发获取传感器数据指令。
      - 接收到前端的测试仪器信息，检查数据正确性
        - 周期检查
        - 测试仪器检查
      - 检查正确后，向主节点发送启动采集命令
        - 发送采集命令后，在 3 秒 时间内，收到启动采集应答，判定对主节点成功实现启动采集，推送启动采集成功信息到前端用户。
        - 经过 3 秒 时间后，未收到启动采集应答，则判定启动采集失败，推送失败消息到前端用户。

  - 实时监测页
    - 

  - 功能配置页
    - 串口信息配置
      - 检查串口号的有效性，未获取本机串口号，仅检查是否符合串口号的标准格式
      - 波特率检查，检查是否为正整数，是否在给定的常用串口数组内
    - 电池参数修改时
      - 不允许 LowBattery > HighBattery 的情况
      - 高低电池参数，接受输入为 大于0 的有效数值，包含小数
      - 电池参数配置成功后，更新程序中的电池电量参数值， Config 常量
    - 传感器ID修改接口返回数据编码实现，前端提示处理实现
      - 传感器ID必须为正整数，且ID在 0-255 范围内，当原始ID与预设ID相等时，不下发数据指令，直接返回修改成功信息到前端。
    - 搜索传感器
      - 通过串口写入，下发指定字节数据到主节点，串口写入失败时，有对应提示
    - 测试模板配置
      - 周期，接受前端输入为 1 -65535 之间的有效数值
      - 温湿度示值，接受前端输入为 有效数值（正负均可）
      - 中心点ID， 接受输入为 1-255 之间的有效数值
      - IDS，接受前端输入为数值数组，每项都必须符合 1-255 的有效数值，且不能出现重复。 
      - 周期获取数据的单位为S，前端输入时，应充分提示用户，周期参数的单位是秒

  - `其他`
    * 数据解析函数优化，每解析一包数据，剩余的不够一包的数据字节必须保留，当前处理为丢弃
      * 已更在， 待 code Review 审查
    * 系统当前状态，是否在测试状态维护，前端获取当前系统是否在测试状态的接口
      * 已实现，测试通过
    * 接收到未在当前测试中配置的传感器数据，将解析后的数据，封装成约定（未约定）的格式，并推送到前台，供用户查看。

### Server 未实现
  * 设备管理页

  * 新增仪器页
    
  * 测试管理页

  * `实时监测页`
    * 

  * `功能配置页`
    * 串口参数配置后，是由程序主动更新 serialport 对象，还是交由用户重新启动程序？

  * `其他`


## 系统相关重要补充
### 检测数据的计算规则
  * 偏差计算：
    > 同一测试中，(温度 / 湿度示值 的平均值) - (所有测试时刻的中心点的温度 / 湿度数据的平均值（有符号数）)
  * 波动度（中心点）：
    > 同一测试中，所有测试时刻的中心点 (温度 / 湿度数据的最大值 - 最小值（有符号数）) / 2
  * 均匀度：
    > 每一测试时刻的差值，等于同一时刻，每组传感器数据中的最大值减最小值；均匀度 = 单次测试中所有时刻差值的平均值。
### 与主节点之间的通信部分补充
  * 温湿度数据（高位在前）
    > 四字节 int ， value = intbe / 100f
  * 电量（低位在前）
    > 原始数据为电压值， value = uint16be / 1000f  (V)
    >> batt = (value - battLow) / (battHigh - battLow) * 100

## 联调问题记录
  * 传感器ID、测试配置，测试模板，测试数据结构中：
    * 中心点ID单独输入处理。其他传感器ID，在数据的存储转移过程中，是否以数值数组的格式处理？
 
  * 一键配置， 中心点与其他ID配置到所有测试仪器
    * 已编码， 未测试
  * 曲线图异常问题， 数据在曲线图 中显示值偏大（类似累加效果）
  * 启动、停止测试 移到顶部导航区域，  启动测试后， 切换到实时监测页
    * 测试仪器配置信息的维护存在未解决问题。

  * 均匀度、波动度、偏差，保留两位小数，整数补零
    * 编码实现， 未测试
  * 电量百分比的计算
    * 编码实现， 未测试
  * 允许挂载单个传感器
    * 必须为中心点ID
  * 只检测数据，不下发周期获取时，无法正常启动
    * 