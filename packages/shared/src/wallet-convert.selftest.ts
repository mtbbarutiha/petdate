/**
 * Run: npx tsx packages/shared/src/wallet-convert.selftest.ts
 */
import { quoteWalletConvert } from './economy';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const rates = { coinPriceToman: 2000, coinSellPriceToman: 1000 };

const buy = quoteWalletConvert('toman', 'coins', 5000, rates);
assert(buy.ok && buy.fromAmount === 4000 && buy.toAmount === 2 && buy.rate === 2000, 'toman→coins quote');

const tooSmall = quoteWalletConvert('toman', 'coins', 1999, rates);
assert(!tooSmall.ok, 'toman→coins below rate fails');

const sell = quoteWalletConvert('coins', 'toman', 3, rates);
assert(sell.ok && sell.fromAmount === 3 && sell.toAmount === 3000 && sell.rate === 1000, 'coins→toman quote');

const star = quoteWalletConvert('stars', 'coins', 7, rates);
assert(star.ok && star.fromAmount === 7 && star.toAmount === 7 && star.rate === 1, 'stars→coins 1:1');

const badPair = quoteWalletConvert('toman', 'stars', 2000, rates);
assert(!badPair.ok, 'unsupported pair');

const empty = quoteWalletConvert('coins', 'toman', 0, rates);
assert(!empty.ok, 'zero amount invalid');

console.log('wallet-convert.selftest: ok');
