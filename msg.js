const fetch = require("node-fetch");
// const notifier = require("node-notifier");

// const sendNotifier = (t, m) => {
//   notifier.notify({ title: t, message: m });
// };

const sendToWechat = async msg => {
  await fetch("http://127.0.0.1:18000/bot/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      msg,
      name: "lovebaby",
      isRoom: true
    })
  });
};

exports.sendMsg = ({ title, message }) => {
  sendToWechat(title + "\n" + message);
};
