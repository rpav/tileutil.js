const {
  say
} = require('../util');

const sharp = require('sharp');

function isRowBlank(size, data, row) {
  const first = (size.w * row * 4);
  for (let x = first; x < first + (size.w * 4); ++x) {
    if (data[x]) return false;
  }

  return true;
}

function isColBlank(size, data, col) {
  for (let y = 0; y < size.h; y++) {
    for (let x = 0; x < 4; ++x) {
      let i = (y * size.w * 4) + ((col * 4) + x);
      if (data[i]) return false;
    }
  }

  return true;
}

async function TrimAlpha(info, im) {
  let size = {
    w: info.width,
    h: info.height
  };

  let data = await im.raw().toBuffer();
  let topY = 0;
  let botY = size.h - 1;
  let lX = 0;
  let rX = size.w - 1;

  for (; topY < size.h; ++topY) {
    if (!isRowBlank(size, data, topY))
      break;
  }
  for (; botY > topY; --botY) {
    if (!isRowBlank(size, data, botY))
      break;
  }
  for (; lX < size.w; ++lX) {
    if (!isColBlank(size, data, lX))
      break;
  }
  for (; rX > lX; --rX) {
    if (!isColBlank(size, data, rX))
      break;
  }

  let w = rX - lX + 1;
  let h = botY - topY + 1;

  // In the case of completely-blank tiles, reserve 1x1
  if(w == 0) { lX = 0; w = 1; }
  if(h == 0) { topY = 0; h = 1; }

  let r = {
    info: {
      srcSize: size,
      rect: { x: lX, y: topY, w: w, h: h },
    },
  }

  let promise = im
      .extract({ left: lX, top: topY, width: w, height: h })
      .ensureAlpha().raw().toBuffer().then(buf => {
        r.data = buf;
        return r;
      });

  return promise;
}

function TrimCmd(argv) {

}

module.exports = {
  TrimCmd,
  TrimAlpha
};
