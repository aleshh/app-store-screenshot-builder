import { slides } from "./slides.mjs";

const gallery = document.getElementById("gallery");

gallery.innerHTML = slides
  .map(
    (slide, index) => `
      <section class="panel" id="slide-${index + 1}" data-output="${slide.output}">
        <div class="panel-inner">
          <h1 class="headline">${slide.headline}</h1>
          <div class="phone-wrap">
            <div class="phone-shadow"></div>
            <div class="phone-stage">
              <img class="screen-image" src="../source/screens/${slide.image}" alt="${slide.headline}">
              <img class="frame-image" src="../source/frame/iphone-frame.png" alt="">
            </div>
          </div>
        </div>
      </section>
    `
  )
  .join("");
