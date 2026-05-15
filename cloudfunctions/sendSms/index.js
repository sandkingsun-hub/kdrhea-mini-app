// sendSms · 腾讯云短信发送
// 入: { phone, scene: "appointment_remind", params: string[] }
// 出: { ok, sendStatus, errorCode }
//
// 模板配置走 ENV:
//   SMS_SECRET_ID, SMS_SECRET_KEY, SMS_APP_ID
//   SMS_SIGN_NAME (如 "KDRHEA 科迪芮雅")
//   SMS_TEMPLATE_APPOINTMENT_REMIND (审核回来填的模板 ID)
//   SMS_REGION (默认 ap-guangzhou)
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const tencentcloud = require("tencentcloud-sdk-nodejs/tencentcloud/services/sms/v20210111");
const SmsClient = tencentcloud.Client;

function getClient() {
  return new SmsClient({
    credential: {
      secretId: process.env.SMS_SECRET_ID || "",
      secretKey: process.env.SMS_SECRET_KEY || "",
    },
    region: process.env.SMS_REGION || "ap-guangzhou",
    profile: {
      httpProfile: { endpoint: "sms.tencentcloudapi.com" },
    },
  });
}

const SCENE_TEMPLATE_MAP = {
  appointment_remind: process.env.SMS_TEMPLATE_APPOINTMENT_REMIND || "",
};

exports.main = async (event = {}) => {
  const { phone, scene, params = [] } = event;
  if (!phone) return { ok: false, code: "NO_PHONE" };
  if (!scene) return { ok: false, code: "NO_SCENE" };

  const templateId = SCENE_TEMPLATE_MAP[scene];
  if (!templateId) return { ok: false, code: "TEMPLATE_NOT_CONFIGURED", scene };

  if (!process.env.SMS_SECRET_ID || !process.env.SMS_APP_ID) {
    return { ok: false, code: "SMS_NOT_CONFIGURED" };
  }

  const normalizedPhone = phone.startsWith("+86") ? phone : `+86${phone}`;

  try {
    const client = getClient();
    const r = await client.SendSms({
      SmsSdkAppId: process.env.SMS_APP_ID,
      SignName: process.env.SMS_SIGN_NAME || "KDRHEA",
      TemplateId: templateId,
      TemplateParamSet: params.map(p => String(p)),
      PhoneNumberSet: [normalizedPhone],
    });
    const item = r.SendStatusSet?.[0];
    return {
      ok: item?.Code === "Ok",
      sendStatus: item?.Code,
      message: item?.Message,
      serialNo: item?.SerialNo,
    };
  } catch (e) {
    return { ok: false, code: "API_ERROR", error: String(e).slice(0, 300) };
  }
};
