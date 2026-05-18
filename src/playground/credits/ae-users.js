const qqAvatar = qq => `http://q.qlogo.cn/headimg_dl?dst_uin=${qq}&spec=140&img_type=jpg`;

const shuffle = list => {
    for (let i = list.length - 1; i > 0; i--) {
        const random = Math.floor(Math.random() * (i + 1));
        const tmp = list[i];
        list[i] = list[random];
        list[random] = tmp;
    }
    return list;
};

const contributors = [
    {
        image: qqAvatar("2381068747"),
        text: "KOSHINO",
        href: "https://github.com/KOSHINOawa"
    },
    {
        image: qqAvatar("3091949883"),
        text: "Cyberexplorer",
        href: "https://github.com/LanwyWriteXU"
    },
    {
        image: qqAvatar("2718867769"),
        text: "A Sean Says",
        href: "https://github.com/SeanShaoJX"
    },
    {
        image: qqAvatar("2153585992"),
        text: "LuoTianyi Arm64",
        href: "https://github.com/LuoTianyi-arm64"
    },
    {
        image: qqAvatar("2913335827"),
        text: "NeuronPulse",
        href: "https://github.com/NeuronPulse"
    }
];

const logo = [
    {
        image: qqAvatar("392824356"),
        text: "MSW11_BiliUP",
        href: "",
    },
];

const website = [
    {
        image: qqAvatar("3669632155"),
        text: "汉堡小猫猫猫猫猫猫",
        href: "",
    },
    {
        image: qqAvatar("316366347"),
        text: "Itz_NanGua",
        href: "https://github.com/NanGua-QWQ",
    },
];

const icon = [
    {
        image: qqAvatar("2891607724"),
        text: "Hypixice",
        href: "https://www.hypixice.top"
    }
];

export default {
    contributors: shuffle(contributors),
    logo: shuffle(logo),
    website: shuffle(website),
    icon: shuffle(icon)
};