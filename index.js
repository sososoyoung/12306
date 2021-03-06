const fs = require("fs");
const https = require("https");
const { table } = require("table");
const { sendMsg } = require("./msg.js");
const { works } = require("./config");
const TIMEOUT = 45;

// String
var ca = fs.readFileSync("./cert/srca.cer.pem");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36";

function request(date, from, to) {
  return new Promise(resolve => {
    const options = {
      hostname: "kyfw.12306.cn", // 12306
      port: 443,
      rejectUnauthorized: false,
      method: "GET",
      path: `/otn/leftTicket/queryZ?leftTicketDTO.train_date=${date}&leftTicketDTO.from_station=${from}&leftTicketDTO.to_station=${to}&purpose_codes=ADULT`,
      ca: [ca], // 证书
      headers: {
        Connection: "keep-alive",
        Host: "kyfw.12306.cn",
        "User-Agent": UA,
        Referer: "https://kyfw.12306.cn/otn/leftTicket/init",
        Cookie:
          "JSESSIONID=995842D0EF97D82DBCE83AC33B6800D2; tk=chOVfSk--pG_50OXf2iseHwwCQMUVFR0Eigofk14L7473s2s0; _jc_save_wfdc_flag=dc; BIGipServerotn=368050698.64545.0000; BIGipServerpool_passport=183304714.50215.0000; RAIL_EXPIRATION=1546779590368; RAIL_DEVICEID=Uf4suubLU31OvMiLM_SoRyPrur5MKZgCy_xRGkIGyRSWu5VPgg6fUlL2USFWV3bH3P8TyYQoLkkt5qXWVGOL6u6nmOUVZIKXpiPunLA91Yu-19i57aQSkFp2M2AZJS60WTxdEw6eCBRcwA2Kl7lwApsk0iXLsIvi; route=c5c62a339e7744272a54643b3be5bf64; _jc_save_toDate=2019-01-04; current_captcha_type=Z; _jc_save_toStation=%u90AF%u90F8%2CHDP; _jc_save_fromStation=%u5317%u4EAC%2CBJP; _jc_save_fromDate=2019-02-02"
      }
    };
    https.get(options, function(res) {
      let data = "";
      res.on("data", function(buff) {
        data += buff; // 查询结果（JSON格式）
      });
      res.on("end", function() {
        try {
          const resData = JSON.parse(data).data;
          resolve(resData);
        } catch (e) {
          console.error("parse err:", e.message);
          resolve({});
        }
      });
      res.on("error", function(err) {
        console.error("request err:", err);
        resolve(err);
      });
    });
  });
}

function showTable({ date, from, to, list }) {
  console.log(`${date}::${from}->${to} at: ${new Date()}`);
  const data = [[`${from}->${to}`, "时间", "硬卧", "硬座", "高2"]];
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

const trainCountMap = {};

function check(date, from, to, removeList, seat = []) {
  console.log(`check: ${from}-${to} ${new Date()}`);
  request(date, from, to)
    .then((data = {}) => {
      const { result = [], map } = data;
      let resultMap = result.map(item => item.split("|"));
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
    .then(({ result, checked, map }) => {
      if (result.length < 1) {
        return reCheck(date, from, to, removeList, seat);
      }
      const name = `${from}_${to}`;
      if (!trainCountMap[name]) {
        trainCountMap[name] = result.length;
      } else if (result.length > trainCountMap[name]) {
        // Object
        sendMsg({ title: name + " 新增车次", message: "检测到新增车次!" });
      }

      const usefull = {
        have: false,
        date,
        from: map[from] || from,
        to: map[to] || to,
        list: []
      };
      checked.forEach((item = {}) => {
        if (
          item &&
          !removeList.includes(item.train_name) &&
          (Number(item.yz) > 0 ||
            // item.yz == '有' ||
            Number(item.g2) > 0 ||
            item.g2 == "有" ||
            Number(item.yw) > 0 ||
            item.yw == "有")
        ) {
          if (
            seat.filter(s => Number(item[s]) > 0 || item[s] == "有").length > 0
          ) {
            usefull.have = true;
            usefull.list.push(item);
          }
        }
      });
      if (usefull.have) {
        sendMsg({
          title: `${date}:${from}-->${to} 有票`,
          message: `列车: ${usefull.list.map(i => i.train_name).join(", ")}`
        });
        showTable(usefull);
      }
      reCheck(date, from, to, removeList, seat);
    })
    .catch(e => {
      console.error("check err:", e);
    });
}

let timer = {};

function reCheck(date, from, to, siteList, seat) {
  let key = `${date}:${from}-->${to}`;
  if (timer[key]) {
    clearTimeout(timer[key]);
  }
  timer[key] = setTimeout(function() {
    check(date, from, to, siteList, seat);
  }, 1000 * TIMEOUT * 1);
}

// start
console.log("start at:", new Date());

for (let idx = 0; idx < works.length; idx++) {
  const conf = works[idx];
  const timeout = 15000 * idx;
  const t = setTimeout(() => {
    clearTimeout(t);
    check(conf.date, conf.from, conf.to, conf.passList, conf.seat);
    sendMsg({
      title: `start check(${15 * works.length}s):`,
      message: `${conf.date}: ${conf.from}--> ${conf.to}`
    });
  }, timeout);
}
