import {Command} from 'commander'
import {_package} from './utils'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import puppeteer from 'puppeteer/lib/cjs/puppeteer/node-puppeteer-core'
import {log} from '@dxworks/cli-common'
import chalk from 'chalk'

export const chr = new Command()
    .name('chr')
    .description(_package.description)
    .argument('<url>', 'Chronos base url')
    .argument('<visualisationsPath>', 'Path to visualisations yaml')
    .option('-w, --width <width>', 'The width of the viewport', parseInt, 2000)
    .option('-h, --height <height>', 'The height of the viewport', parseInt, 2000)
    .option('-o, --output [output]', 'The path of the output file', path.resolve(process.cwd(), 'results'))
    .action(extractVis)


export async function extractVis(url: string, visualisationsPath: string, options: { width: number, height: number, output: string }): Promise<void> {
    log.info('Starting Chronos Vis Puppet')
    mkdir(path.resolve(options.output))
    mkdir(path.resolve(options.output, 'sysmap'))
    mkdir(path.resolve(options.output, 'chart'))
    mkdir(path.resolve(options.output, 'graph'))

    const visualizations = YAML.parse(fs.readFileSync(visualisationsPath, 'utf8')) as Visualisations

    const projectsUrl = 'api/analysis/projects'
    let sysmaps = await getVisData(url, `${projectsUrl}/sysmaps`, 'analysis/system-map', ['svg#CreateSystemMap'], 'sysmap')
    sysmaps = sysmaps.filter(sysmap => visualizations.sysmaps.some(it => sysmap.name.match(it)))

    const charts = (await getVisData(url, `${projectsUrl}/graphs`, 'analysis/chart/create', ['svg.charts-container'], 'chart', response => response.graphs))
        .filter(chart => visualizations.charts.some(it => chart.name.match(it)))

    const graphs = (await getVisData(url, `${projectsUrl}/couplings/views`, 'analysis/coupling', ['svg#edge-bundle-graph', 'svg#force_layout'], 'graph', res => res.map((it: any) => ({
        name: it.name,
        id: it.viewId,
    }))))
        .filter(graph => visualizations.graphs.some(it => graph.name.match(it)))

    await saveVisualisations(sysmaps, url, options)
    await saveVisualisations(charts, url, options)
    await saveVisualisations(graphs, url, options)

    log.info(`Pictures saved at ${options.output}`)
}

async function saveVisualisations(viss: Vis[], url: string, options: { width: number; height: number; output: string }) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.setViewport({width: options.width, height: options.height})

    for (const vis of viss) {
        const elements = []
        log.info(`Getting ${chalk.yellow(vis.name)}`)
        await page.goto(`${url}/${vis.url}`, {waitUntil: 'networkidle2'})
        for (const selector of vis.selectors) {
            const svg = await page.$(selector)
            if (svg) {
                elements.push(svg)
            }
        }
        if (elements.length) {
            if (elements.length == 1) {
                await elements[0]?.screenshot({path: path.resolve(options.output, vis.type, `${vis.name}-${vis.id}.png`)})
            } else {
                for (let i = 0; i < elements.length; i++) {
                    await elements[i].screenshot({path: path.resolve(options.output, vis.type, `${vis.name}-${vis.id}-${i}.png`)})
                }
            }
        }
    }

    await browser.close()
}

function mkdir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
}

async function getVisData(url: string,
                          visDataUrlPath: string,
                          visUrlPath: string,
                          selectors: string[],
                          type: string,
                          visArrayGetter: (response: any) => any[] = r => r): Promise<Vis[]> {

    const response = await fetch(`${url.removeSuffix('/')}/${visDataUrlPath}`)
    const responseData = await response.json()
    return visArrayGetter(responseData).map((vis: { id: number; name: string }) => {
        return {
            id: vis.id,
            name: vis.name,
            url: `${visUrlPath}/${vis.id}`,
            selectors,
            type,
        }
    })
}

interface Vis {
    id: number
    name: string
    url: string
    selectors: string[]
    type: string
}

interface Visualisations {
    charts: string[]
    sysmaps: string[]
    graphs: string[]
}
