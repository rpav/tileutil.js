const process = require('process');

function toStr(x) {
  if (typeof x == 'string' || typeof x == 'number') {
    return x.toString();
  }

  return require('util').inspect(x);
}

function str(...s) {
  return s.map(toStr).join('');
}

function say(...s) {
  console.log(str(...s));
}


class Timer {
  start() {
    let start = process.hrtime();
    this.start = this.hrToS(start);
    this.last = this.start;
  }

  s() {
    this.now = this.hrToS(process.hrtime());
    this.diffLast = this.now - this.last;
    this.diffStart = this.now - this.start;
    this.last = this.now;

    return this.now;
  }

  ms() {
    return this.s() * 1000;
  }

  toString() {
    this.s();
    return str(this.diffStart.toPrecision(5), "s");
  }

  hrToS(hr) {
    return hr[0] + (hr[1] / 1e+9);
  }

  lastDiffString() {
    return str(this.diffLast.toPrecision(5), "s");
  }
};


module.exports = {
  toStr,
  say,
  Timer,
}
