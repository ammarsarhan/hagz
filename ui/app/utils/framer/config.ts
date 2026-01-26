const transition = {
    type: "tween" as const,
    duration: 1,
    ease: [0.22, 1, 0.36, 1] as const,
}

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1, when: "beforeChildren" }
    },
    exit: { opacity: 0 }
};

const item = {
    hidden: { opacity: 0, y: 4 },
    show: {
        opacity: 1,
        y: 0,
        transition: transition
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: transition
    },
};

const config = { transition, container, item };
export default config;
