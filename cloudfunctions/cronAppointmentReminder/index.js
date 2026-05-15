// cronAppointmentReminder · 每 30 分钟跑 · 找 24h 内未推送的 confirmed 预约发提醒
// 触发器: timer "0 */30 * * * *"
// 入: { dryRun?: bool, force?: bool }
// 出: { ok, scanned, sent24h, smsFallback, errors, sample }
//
// 业务规则（单提醒版 · 一次性订阅）:
//   - 预约状态 confirmed + finalDate 在 24h 内 + 未推送过
//   - 优先订阅消息 · 失败 / quota=0 / 未订阅 fallback 短信
//   - 模板字段：time2 预约时间 / thing7 预约项目 / name6 预约客户 / thing9 温馨提示
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 模板 ID · 默认值是 KDRHEA 公众平台的「预约提醒」 · ENV 覆盖
const TEMPLATE_REMIND = process.env.WX_TEMPLATE_APPOINTMENT_REMIND || "ihiIWdBcjupzX1Fx9aFlmqbamuhE7m_VN6IohCBvfNI";
const TARGET_PAGE = "pages/appointment/list";

function getBeijingDate(d = new Date()) {
  return new Date(d.getTime() + 8 * 3600 * 1000);
}

// finalDate ("YYYY-MM-DD") + finalSlot ("morning"|"afternoon"|"evening") → ISO 时间锚点
function appointmentAnchorTime(finalDate, finalSlot) {
  if (!finalDate || !/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) return null;
  let h = 10;
  if (finalSlot === "afternoon") h = 14;
  else if (finalSlot === "evening") h = 17;
  // 北京时间 · 转 UTC
  const [Y, M, D] = finalDate.split("-").map(Number);
  // 北京 H:00:00 = UTC (H-8):00:00
  const utcH = h - 8;
  // 用 Date.UTC 构造
  return new Date(Date.UTC(Y, M - 1, D, utcH, 0, 0));
}

async function sendSubscribeMessage(openid, data, page) {
  if (!TEMPLATE_REMIND) return { ok: false, reason: "NO_TEMPLATE" };
  try {
    const r = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: TEMPLATE_REMIND,
      page,
      data,
      miniprogramState: "formal",
    });
    return { ok: r.errCode === 0, errCode: r.errCode, errMsg: r.errMsg };
  } catch (e) {
    return { ok: false, reason: "API_ERROR", error: String(e).slice(0, 200) };
  }
}

async function sendSmsFallback(phone, name, time) {
  if (!phone) return { ok: false, reason: "NO_PHONE" };
  try {
    const r = await cloud.callFunction({
      name: "sendSms",
      data: { phone, scene: "appointment_remind", params: [name || "您", time] },
    });
    return { ok: r.result?.ok || false, detail: r.result };
  } catch (e) {
    return { ok: false, reason: "SMS_ERROR", error: String(e).slice(0, 200) };
  }
}

exports.main = async (event = {}) => {
  const { dryRun = false, force = false } = event;
  const now = new Date();
  const result = { scanned: 0, sent24h: 0, smsFallback: 0, errors: 0, sample: [] };

  // 拉所有 confirmed 预约 · 限制最近 3 天内 finalDate
  const todayBJ = getBeijingDate(now);
  const dateFrom = new Date(todayBJ.getTime() - 86400000).toISOString().slice(0, 10);
  const dateTo = new Date(todayBJ.getTime() + 3 * 86400000).toISOString().slice(0, 10);

  let appts;
  try {
    const r = await db.collection("appointments")
      .where({
        status: "confirmed",
        finalDate: _.and(_.gte(dateFrom), _.lte(dateTo)),
      })
      .limit(200)
      .get();
    appts = r.data;
  } catch (e) {
    if (String(e).includes("not exist")) return { ok: true, ...result };
    throw e;
  }

  for (const appt of appts) {
    result.scanned += 1;
    const anchor = appointmentAnchorTime(appt.finalDate, appt.finalSlot);
    if (!anchor) continue;

    const diffMs = anchor.getTime() - now.getTime();
    const remindersSent = appt.remindersSent || {};
    // 单提醒 · 24h 前一次（22-25h 窗口内 · 兼容定时器 30 分钟粒度）
    const wantH24 = diffMs > 0 && diffMs <= 25 * 3600 * 1000 && diffMs > 22 * 3600 * 1000 && !remindersSent.h24;
    if (!wantH24 && !force) continue;

    const friendlyTime = appt.finalDate + " " + (
      appt.finalSlot === "morning" ? "上午 10:00"
      : appt.finalSlot === "afternoon" ? "下午 14:00"
      : appt.finalSlot === "evening" ? "晚间 17:00"
      : appt.finalSlot
    );

    // 拉 user
    let user = null;
    try {
      const u = await db.collection("users").where({ _openid: appt._openid }).limit(1).get();
      user = u.data[0] || null;
    } catch {}
    if (!user) { result.errors += 1; continue; }

    const sampleItem = { _id: appt._id, hasSubscribe: (user.reminderQuotaRemaining || 0) > 0, phone: !!user.phone };

    if (dryRun) {
      result.sample.length < 5 && result.sample.push(sampleItem);
      continue;
    }

    let success = false;
    let channel = "subscribe";

    // 优先订阅消息 · 字段映射 time2/thing7/name6/thing9
    if ((user.reminderQuotaRemaining || 0) > 0 && TEMPLATE_REMIND) {
      const subRes = await sendSubscribeMessage(appt._openid, {
        time2: { value: friendlyTime.slice(0, 20) },
        thing7: { value: (appt.skuName || appt.skuCategory || "治疗预约").slice(0, 20) },
        name6: { value: (appt.customerName || user.nickname || "您").slice(0, 10) },
        thing9: { value: "KDRHEA 期待您的到来" },
      }, TARGET_PAGE);
      if (subRes.ok) {
        success = true;
        await db.collection("users").doc(user._id).update({
          data: { reminderQuotaRemaining: db.command.inc(-1) },
        });
      }
    }

    // Fallback 短信
    if (!success && (user.phone || appt.customerPhone)) {
      const smsRes = await sendSmsFallback(user.phone || appt.customerPhone, appt.customerName || user.nickname, friendlyTime);
      if (smsRes.ok) {
        success = true;
        channel = "sms";
        result.smsFallback += 1;
      }
    }

    if (success) {
      await db.collection("appointments").doc(appt._id).update({
        data: {
          "remindersSent.h24": { sentAt: now.toISOString(), channel },
          lastReminderAt: now.toISOString(),
        },
      });
      result.sent24h += 1;
    } else {
      result.errors += 1;
    }

    sampleItem.success = success;
    sampleItem.channel = channel;
    result.sample.length < 5 && result.sample.push(sampleItem);
  }

  return { ok: true, ...result };
};
