import {Command} from 'commander'
import {_package} from './utils'
import puppeteer from 'puppeteer/lib/cjs/puppeteer/node-puppeteer-core'

export const mainCommand = new Command()
    .name('vis-puppet')
    .description(_package.description)
    .argument('<url>', 'The url of the page to load')
    .argument('<selector>', 'The unique selector of the element to screenshot')
    .option('-w, --width <width>', 'The width of the viewport', parseInt, 2000)
    .option('-h, --height <height>', 'The height of the viewport', parseInt, 2000)
    .option('-o, --output <output>', 'The path of the output file')
    .version(_package.version, '-v, -version, --version, -V')
    .action(extractVis)

export async function extractVis(url: string, selector: string, options: { width: number, height: number, output: string }): Promise<void> {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.setViewport({width: options.width, height: options.height})
    await page.goto(url, {waitUntil: 'networkidle2'})
    const chart = await page.$(selector)
    await chart?.screenshot({path: options.output})
    await browser.close()
}
