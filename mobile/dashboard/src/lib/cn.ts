const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ');
export default cn;