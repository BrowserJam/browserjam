import { Node, parse } from "./parser";
import { render } from "./renderer";

const PROXY_HOST = window.location.href.includes("localhost")
  ? "http://localhost:8090"
  : "https://browser.mbkv.io/proxy";

async function fetchPage(url: string) {
  // gotta proxy due to cors errors
  const proxied = `${PROXY_HOST}/${url}`;
  const resp = await fetch(proxied);
  const text = await resp.text();

  return text;
}

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const htmlDisplay = document.getElementById(
    "inputhtml",
  ) as HTMLTextAreaElement;
  const addressBar = document.getElementById(
    "address-bar",
  )! as HTMLInputElement;
  let text: string | undefined;
  let html: Node | undefined;

  async function resize() {
    if (canvas.parentElement) {
      const ratio = window.devicePixelRatio;
      const width = canvas.parentElement.clientWidth;
      const height = canvas.parentElement.clientHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = canvas.parentElement.clientWidth * ratio;
      canvas.height = canvas.parentElement.clientHeight * ratio;
    }
  }

  async function run() {
    text = await fetchPage(addressBar.value);
    html = parse(text);
    htmlDisplay.textContent = html.html();

    resize();
    render(canvas, html);
  }

  addressBar.addEventListener("blur", run);
  run();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
