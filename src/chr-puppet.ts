import { Command } from 'commander'
import { _package } from './utils'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import puppeteer from 'puppeteer/lib/cjs/puppeteer/node-puppeteer-core'

export const chrPuppet = new Command()
    .name('chr-puppet')
    .description(_package.description)
    .argument('<url>', 'Chronos base url')
    .option('<visualisationsPath>', 'Path to visualisations yaml')
    .option('-w, --width <width>', 'The width of the viewport', parseInt, 2000)
    .option('-h, --height <height>', 'The height of the viewport', parseInt, 2000)
    .option('-o, --output <output>', 'The path of the output file', '.')
    .version(_package.version, '-v, -version, --version, -V')
    .action(extractVis)


export async function extractVis(url: string, visualisationsPath: string, options: { width: number, height: number, output: string }): Promise<void> {
    mkdir(options.output)
    const visualizations = YAML.parse(fs.readFileSync(visualisationsPath, 'utf8')) as Visualisations

    const projectsUrl = 'api/analysis/projects'
    let sysmaps = await getVisData(url, `${projectsUrl}/sysmaps`, 'analysis/system-map', '#CreateSystemMap')
    sysmaps = sysmaps.filter(sysmap => visualizations.sysmaps.includes(sysmap.name))

    const charts = (await getVisData(url, `${projectsUrl}/graphs`, 'analysis/chart/create', '.charts-container', response => response.graphs))
        .filter(chart => visualizations.charts.includes(chart.name))

    // const coupling = (await getVisData(url, `${projectsUrl}/graphs, `))

    await saveVisualisations(sysmaps, url, options)
    await saveVisualisations(charts, url, options)
    // await saveVisualisations(coupling, url, options)
}

async function saveVisualisations(viss: Vis[], url: string, options: { width: number; height: number; output: string }) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.setViewport({ width: options.width, height: options.height })

    for (const vis of viss) {
        console.log(`Getting ${vis.name}`)
        await page.goto(`${url}/${vis.url}`, { waitUntil: 'networkidle2' })
        const svg = await page.$(`svg${vis.svgClass}`)
        await svg?.screenshot({ path: `${options.output}/${vis.name}.png` })
    }
    await browser.close()
}

function mkdir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(path.join('.', dir))
    }
}

async function getVisData(url: string,
    visDataUrlPath: string,
    visUrlPath: string,
    svgClass: string,
    visArrayGetter: (response: any) => any[] = r => r): Promise<Vis[]> {

    const response = await fetch(`${url}/${visDataUrlPath}`)
    const content = await response.buffer()
    const resposeContent = JSON.parse(content.toString())
    return visArrayGetter(resposeContent).map((vis: { id: number; name: string }) => {
        return {
            id: vis.id,
            name: vis.name,
            url: `${visUrlPath}/${vis.id}`,
            svgClass: svgClass,
        }
    })
}

interface Vis { id: number, name: string, url: string, svgClass: string }

interface Visualisations { charts: string[], sysmaps: string[], coupling: string[] }
