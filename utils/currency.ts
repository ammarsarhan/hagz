export default function getCurrencyFormat (value: number) {
    let currencyFormat = value && new Intl.NumberFormat('en-US', {style: 'currency', currency: 'EGP'}).format(value);
    currencyFormat === 0 ? currencyFormat = "EGP 0.00" : null;
    
    return currencyFormat;
}