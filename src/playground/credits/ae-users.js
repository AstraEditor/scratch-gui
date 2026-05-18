import koshino from './AE_images/koshino.jpg'
import aseansays from './AE_images/a_sean_says.jpg'
import cyberexplorer from './AE_images/cyberexplorer.jpg'
import luotianyi from './AE_images/luotianyi.jpg'
import np from './AE_images/np.jpg'
import msw from './AE_images/msw.jpg'
import cat from './AE_images/cat.jpg'
import nangua from './AE_images/nangua.jpg'
import hypixice from './AE_images/hypi.jpg'

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
        image: koshino,
        text: "KOSHINO",
        href: "https://github.com/KOSHINOawa"
    },
    {
        image: cyberexplorer,
        text: "Cyberexplorer",
        href: "https://github.com/LanwyWriteXU"
    },
    {
        image: aseansays,
        text: "A Sean Says",
        href: "https://github.com/SeanShaoJX"
    },
    {
        image: luotianyi,
        text: "LuoTianyi-arm64",
        href: "https://github.com/LuoTianyi-arm64"
    },
    {
        image: np,
        text: "NeuronPulse",
        href: "https://github.com/NeuronPulse"
    }
];

const logo = [
    {
        image: msw,
        text: "𝑚𝑠𝑤饿饿的",
        href: ""
    }
];

const website = [
    {
        image: cat,
        text: "世界第一可爱傲娇汉堡小猫",
        href: ""
    },
    {
        image: nangua,
        text: "Itz_NanGua",
        href: "https://github.com/NanGua-QWQ"
    }
];

const icon = [
    {
        image: hypixice,
        text: "Hypixice",
        href: "https://www.hypixice.top"
    }
]

export default {
    contributors: shuffle(contributors),
    logo: shuffle(logo),
    website: shuffle(website),
    icon: shuffle(icon)
};
