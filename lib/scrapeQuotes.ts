import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import type { Author, Quote } from '@/types';

import { prisma } from '@/lib/prisma';

puppeteer.use(StealthPlugin());

const authorsURL = {
  marcus: '17212.Marcus_Aurelius',
  seneca: '4918776.Seneca',
  epictetus: '13852.Epictetus',
  zeno: '833825.Zeno_of_Citium',
};

async function scrapeQuotes(autorName: Author, totalPages = 1) {
  console.log(`Starting to scrape ${autorName}...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1024 });
  const authorQuotes: Quote[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const URL = `https://www.goodreads.com/author/quotes/${authorsURL[autorName]}${i === 1 ? '' : `?page=${i}`}`;
    await page.goto(URL, {
      waitUntil: 'networkidle2',
    });

    const quotes = await page.evaluate(() => {
      const quotesArray = document.querySelectorAll('.quoteText');
      return Array.from(quotesArray).map(quoteElement => {
        const quoteElementText = quoteElement.textContent;
        const author =
          quoteElement
            .querySelector('span.authorOrTitle')
            ?.textContent.replace(',', '')
            .trim() || '';
        const bookLink =
          quoteElement.querySelector('a.authorOrTitle')?.textContent.trim() ||
          '';
        const textWithoutAuthor = quoteElementText.replace(author, '');
        const cleanText = textWithoutAuthor
          .replace(bookLink, '')
          .replace(/\s+/g, ' ')
          .replace(/,(?=[^,]*$)/, '')
          .replace('“', '')
          .replace('”', '')
          .replace('―', '')
          .trim();

        return {
          quote: cleanText,
          author,
        };
      });
    });

    authorQuotes.push(...quotes);
  }

  try {
    for (const quote of authorQuotes) {
      const { quote: quoteText, author } = quote;
      await prisma.quote.create({ data: { quote: quoteText, author } });
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error saving to DB:', error.message);
    }
  }

  await browser.close();
  return authorQuotes;
}

// Scrape all author's quotes
await scrapeQuotes('marcus');
await scrapeQuotes('epictetus');
await scrapeQuotes('seneca');
await scrapeQuotes('zeno');
