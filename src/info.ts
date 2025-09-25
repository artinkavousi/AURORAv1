/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { Pane } from 'tweakpane';
import * as InfodumpPlugin from 'tweakpane-plugin-infodump';

export default class Info {
  private container: HTMLDivElement;
  private pane: Pane;
  private textBlade: { controller: { view: { element: HTMLElement } } };

  constructor() {
    this.container = document.createElement('div');
    document.body.appendChild(this.container);
    Object.assign(this.container.style, {
      position: 'absolute',
      left: '8px',
      bottom: '8px',
      maxWidth: '512px',
      width: 'calc(100% - 16px)',
    });

    this.pane = new Pane({ container: this.container });
    this.pane.registerPlugin(InfodumpPlugin);

    const info = this.pane.addFolder({
      title: 'info',
      expanded: false,
    });

    const credits = this.pane.addFolder({
      title: 'credits',
      expanded: false,
    });
    credits.element.style.marginLeft = '0px';

    this.textBlade = info.addBlade({
      view: 'infodump',
      content:
        'Realtime MLS-MPM simulation in the Browser, using WebGPU and written in [ThreeJS](https://threejs.org) TSL. Inspired by the works of [Refik Anadol](https://refikanadol.com).\n\n' +
        'MLS-MPM implementation is heavily based on [WebGPU-Ocean](https://github.com/matsuoka-601/WebGPU-Ocean) by [matsuoka-601](https://github.com/matsuoka-601).\n\n' +
        'View the source code [here](https://github.com/holtsetio/flow/).\n\n' +
        '[> Other experiments](https://holtsetio.com)',
      markdown: true,
    }) as unknown as Info['textBlade'];

    credits.addBlade({
      view: 'infodump',
      content:
        '[HDRi background](https://polyhaven.com/a/autumn_field_puresky) by Jarod Guest and Sergej Majboroda on [Polyhaven.com](https://polyhaven.com).\n\n' +
        '[Concrete plaster wall texture](https://www.texturecan.com/details/216/) by [texturecan.com](https://texturecan.com).\n\n',
      markdown: true,
    });
  }

  setText(content: string): void {
    this.textBlade.controller.view.element.innerHTML = `<div class="tp-induv_t"><p>${content}</p></div>`;
    this.pane.refresh();
  }

  dispose(): void {
    this.pane.dispose();
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
