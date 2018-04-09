const fs = require('fs');
const https = require('https');
const notifier = require('node-notifier');
const { table } = require('table');
// String
var ca = fs.readFileSync('./cert/srca.cer.pem');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36';

function request(date, from, to, num) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'kyfw.12306.cn', // 12306
      port: 443,
      rejectUnauthorized: false,
      method: 'GET',
      path: `/otn/leftTicket/queryO?leftTicketDTO.train_date=${date}&leftTicketDTO.from_station=${from}&leftTicketDTO.to_station=${to}&purpose_codes=ADULT`,
      ca: [ca], // 证书
      headers: {
        Connection: 'keep-alive',
        Host: 'kyfw.12306.cn',
        'User-Agent': UA,
        Referer: 'https://kyfw.12306.cn/otn/leftTicket/init',
        Cookie:
          'JSESSIONID=DECF7F5103D1BA7A8F335811EB98A41A; fp_ver=4.5.1; RAIL_EXPIRATION=1506056378568; RAIL_DEVICEID=O55geSebql5oIo_pSxFwIOYuE1-3h4_KUSs4yzI5E408_mf-0xwpj2inSot9OSQYngOfPM9Wo3qpwWGMhJVNboPEKIDXzp0zpbGNnrppoKunrMmxzmd33W4EDE9FVZfwINu3MS2pmt8u1jaXNU2Lp3hs9iM9Dq0m; route=9036359bb8a8a461c164a04f8f50b252; BIGipServerotn=384827914.38945.0000; _jc_save_fromStation=%u5317%u4EAC%2CBJP; _jc_save_toStation=%u90AF%u90F8%2CHDP; _jc_save_fromDate=2017-09-30; _jc_save_toDate=2017-09-21; _jc_save_wfdc_flag=dc'
      }
    };
    const req = https.get(options, function(res) {
      let data = '';
      res.on('data', function(buff) {
        data += buff; // 查询结果（JSON格式）
      });
      res.on('end', function() {
        try {
          const resData = JSON.parse(data).data;
          resolve(resData);
        } catch (e) {
          console.error('parse err:', e);
          resolve({});
        }
      });
      res.on('error', function(err) {
        console.error('request err:', err);
        resolve(err);
      });
    });
  });
}

function showTable({ date, from, to, list }) {
  console.log(`${date}::${from}->${to} at: ${new Date()}`);
  const data = [[`${from}->${to}`, '时间', '硬卧', '硬座', '高2']];
  list.forEach(item => {
    data.push([
      item.train_name,
      `${item.start_time}->${item.end_time}`,
      item.yw,
      item.yz,
      item.g2
    ]);
  });
  const output = table(data);
  console.log(output);
}
function check(date, from, to, num, siteList) {
  console.log(`check: ${from}-${to} ${new Date()}`);
  request(date, from, to, num)
    .then((data = {}) => {
      const { result = [], map } = data;
      let resultMap = result.map(item => item.split('|'));
      return {
        len: resultMap.length,
        map,
        result: resultMap,
        checked: resultMap.map((item = []) => ({
          train_name: item[3],
          date: item[13],
          start_time: item[8],
          end_time: item[9],
          totel_time: item[10],
          gt: item[32],
          g1: item[31],
          g2: item[30],
          yw: item[28],
          yz: item[29],
          wz: item[26]
        }))
      };
    })
    .then(({ result, len, checked, map }) => {
      const log = (...args) => {
        console.log(`${new Date()}::${date}:${from}-->${to}`);
        console.log(...args);
      };
      if (num && result.length > num) {
        // Object
        notifier.notify({ title: '新增车次', message: '检测到新增车次!' });
      }
      const usefull = {
        have: false,
        date,
        from: map[from] || from,
        to: map[to] || to,
        list: []
      };
      checked.forEach((item = {}, index) => {
        if (
          item &&
          siteList.includes(item.train_name) &&
          (Number(item.yz) > 0 ||
            item.yz == '有' ||
            Number(item.g2) > 0 ||
            item.g2 == '有' ||
            Number(item.yw) > 0 ||
            item.yw == '有')
        ) {
          usefull.have = true;
          usefull.list.push(item);
        }
      });
      if (usefull.have) {
        notifier.notify({
          title: `${date}:${from}-->${to} 有票`,
          message: usefull.list[0].date
        });
        showTable(usefull);
      }
      reCheck(date, from, to, num, siteList);
    })
    .catch(e => {
      console.error('check err:', e);
    });
}
let timer = {};
function reCheck(date, from, to, num, siteList) {
  let key = `${date}:${from}-->${to}`;
  if (timer[key]) {
    clearTimeout(timer[key]);
  }
  timer[key] = setTimeout(function() {
    check(date, from, to, num, siteList);
  }, 1000 * 60 * 1);
}
console.log('start at:', new Date());

const goList = ['T7', 'T231', 'Z19', 'Z43'];
const backList = ['T42', 'T56', 'T232', 'Z20', 'Z44'];
check('2018-04-28', 'BJP', 'XAY', 0, goList);
check('2018-05-01', 'XAY', 'BJP', 0, backList);
