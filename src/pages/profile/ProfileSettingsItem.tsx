import { View } from "@tarojs/components";

function ProfileSettingsItem({ icon, label, color, onClick }) {
  return (
    <View className="flex cursor-pointer items-center justify-between py-4" onClick={onClick}>
      <View className="flex items-center">
        <View className={`bg-${color}-100 mr-6 h-12 w-12 flex items-center justify-center rounded-full`}>
          <View className={`${icon} text-${color}-500 text-lg font-bold`}></View>
        </View>
        <View className="text-[#232323] font-400">{label}</View>
      </View>
      <View
        className="flex items-center justify-center rounded-full"
        onClick={onClick}
      >
        <View className="i-tabler-chevron-right text-lg text-[#232323] font-bold"></View>
      </View>
    </View>
  );
}

export default ProfileSettingsItem;
