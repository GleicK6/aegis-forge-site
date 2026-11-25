(() => {
  const canvas = document.querySelector('#forge-scene');
  const paint = canvas.getContext('2d');
  if (!paint) return;

  const art = canvas.parentElement;
  const toggle = art.querySelector('.scene-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = { width: 600, height: 520, x: 300, y: 366, unit: 96 };
  const yaw = -.32;
  const pitch = .38;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const tau = Math.PI * 2;
  const dome = { radius: 2.67, height: 3.08 };
  const forgeScale = .79;
  const forgeCenter = [.16, 0, -.10];
  const cameraDistance = 10.4;
  const cameraDirection = [sy * cp, sp, cy * cp];
  const cameraPosition = cameraDirection.map((value) => value * cameraDistance);
  const strike = 480;
  const contactHold = 24;
  const rotationPeriod = 34000;
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const ease = (t) => t * t * (3 - 2 * t);
  const subtract = (a, b) => a.map((value, i) => value - b[i]);
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalize = (v) => {
    const length = Math.hypot(...v) || 1;
    return v.map((value) => value / length);
  };

  function project([x, y, z]) {
    const horizontalDepth = x * sy + z * cy;
    const depth = horizontalDepth * cp + y * sp;
    const perspective = cameraDistance / (cameraDistance - depth);
    return {
      x: stage.x + stage.unit * (x * cy - z * sy) * perspective,
      y: stage.y - stage.unit * (y * cp - horizontalDepth * sp) * perspective,
      depth,
    };
  }

  function orient([x, y, z], angle, shift) {
    return [x * Math.cos(angle) - y * Math.sin(angle) + shift[0], x * Math.sin(angle) + y * Math.cos(angle) + shift[1], z + shift[2]];
  }

  function triangulate(outline) {
    const polygon = outline.map((_, i) => i);
    const triangles = [];
    const winding = ([ax, ay], [bx, by], [cx, cy]) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    while (polygon.length > 3) {
      const ear = polygon.findIndex((current, i) => {
        const previous = polygon.at(i - 1);
        const next = polygon[(i + 1) % polygon.length];
        const [a, b, c] = [outline[previous], outline[current], outline[next]];
        return winding(a, b, c) > 0 && !polygon.some((other) => {
          if (other === previous || other === current || other === next) return false;
          const point = outline[other];
          return winding(a, b, point) >= 0 && winding(b, c, point) >= 0 && winding(c, a, point) >= 0;
        });
      });
      if (ear < 0) break;
      triangles.push([polygon.at(ear - 1), polygon[ear], polygon[(ear + 1) % polygon.length]]);
      polygon.splice(ear, 1);
    }
    if (polygon.length === 3) triangles.push(polygon);
    return triangles;
  }

  function mesh(outline, halfDepth, bevel, color) {
    const winding = outline.reduce((sum, [x, y], i) => {
      const [nextX, nextY] = outline[(i + 1) % outline.length];
      return sum + x * nextY - y * nextX;
    }, 0);
    const points = winding > 0 ? outline : [...outline].reverse();
    const inner = points.map(([x, y], i) => {
      const previous = points.at(i - 1);
      const next = points[(i + 1) % points.length];
      const incoming = normalize([previous[1] - y, x - previous[0]]);
      const outgoing = normalize([y - next[1], next[0] - x]);
      const bisector = normalize([incoming[0] + outgoing[0], incoming[1] + outgoing[1]]);
      const offset = bevel / Math.max(.58, dot(bisector, outgoing));
      return [x + bisector[0] * offset, y + bisector[1] * offset];
    });
    const depth = (x) => typeof halfDepth === 'number' ? halfDepth : halfDepth(x);
    const front = inner.map(([x, y], i) => [x, y, depth(...points[i])]);
    const back = front.map(([x, y, z]) => [x, y, -z]);
    const outside = points.map(([x, y]) => [x, y, Math.max(.012, depth(x) - bevel)]);
    const underside = outside.map(([x, y, z]) => [x, y, -z]);
    const triangles = [];
    const triangle = (a, b, c) => triangles.push({
      vertices: [a, b, c],
      normal: normalize(cross(subtract(b, a), subtract(c, a))),
    });
    const quad = (a, b, c, d) => { triangle(a, b, c); triangle(a, c, d); };

    for (const [a, b, c] of triangulate(inner)) {
      triangle(front[a], front[b], front[c]);
      triangle(back[a], back[c], back[b]);
    }
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      quad(front[i], outside[i], outside[j], front[j]);
      quad(outside[i], underside[i], underside[j], outside[j]);
      quad(back[i], back[j], underside[j], underside[i]);
    }
    return { triangles, color };
  }

  const anvil = mesh([
    [-.68, 1.25], [-.49, 1.39],
    [-.44, 1.49], [1.32, 1.49], [1.32, 1.32], [1.21, 1.19],
    [.91, 1.08], [.60, 1.03], [.45, .90], [.38, .72],
    [.43, .48], [.63, .34], [.78, .31], [.81, .10], [.72, .055],
    [-.73, .055], [-.80, .115], [-.78, .29], [-.60, .34], [-.42, .49],
    [-.37, .69], [-.44, .86], [-.66, 1.04],
  ], .42, .058, [.37, .41, .40]);
  const horn = mesh([
    [-1.48, 1.17], [-1.26, 1.215], [-.92, 1.265],
    [-.59, 1.29], [-.55, 1.06], [-.76, 1.06], [-1.14, 1.095],
  ], (x) => mix(.034, .40, clamp((x + 1.48) / .89)), .026, [.43, .47, .45]);
  const face = mesh([
    [-.47, 1.45], [-.40, 1.50], [1.31, 1.50], [1.34, 1.46], [1.31, 1.40], [-.47, 1.40],
  ], .446, .018, [.65, .68, .64]);

  const hammerHead = mesh([
    [-1.19, -.19], [-.72, -.19], [-.665, -.12], [-.66, .045], [-.71, .12],
    [-.78, .155], [-1.11, .155], [-1.18, .10], [-1.22, -.04], [-1.22, -.13],
  ], .214, .045, [.40, .455, .475]);
  const strikingFace = mesh([
    [-1.20, -.215], [-1.16, -.178], [-.74, -.178], [-.695, -.218],
    [-.695, -.278], [-.735, -.32], [-1.16, -.32], [-1.20, -.277],
  ], .246, .028, [.70, .73, .71]);
  const peen = mesh([
    [-1.16, .095], [-.73, .095], [-.745, .17], [-.835, .259],
    [-.875, .275], [-1.065, .275], [-1.117, .229],
  ], (x) => mix(.154, .183, clamp((x + 1.16) / .42)), .032, [.53, .58, .60]);
  const hammerShaft = mesh([
    [-.74, -.06], [-.47, -.065], [.29, -.049], [.34, -.021],
    [.34, .040], [.30, .061], [-.47, .061], [-.74, .073],
  ], .058, .026, [.43, .48, .47]);
  const collar = mesh([
    [-.76, -.086], [-.52, -.077], [-.46, -.049], [-.46, .051],
    [-.52, .080], [-.76, .093],
  ], .086, .022, [.61, .65, .63]);
  const grip = mesh([
    [-.13, -.061], [-.08, -.085], [.27, -.092], [.33, -.069], [.348, -.038],
    [.348, .038], [.32, .073], [.26, .084], [-.08, .078], [-.13, .052],
  ], .087, .025, [.21, .235, .23]);
  const gripRings = [-.042, .055, .15, .245].map((x) => mesh([
    [x, -.082], [x + .016, -.087], [x + .016, .082], [x, .077],
  ], .089, .005, [.31, .346, .33]));
  const parts = [anvil, horn, face, hammerShaft, collar, grip, ...gripRings, hammerHead, peen, strikingFace];
  const anvilPartCount = 3;
  const contact = [-.09, 1.50, .025];
  function forgeTurn(time) {
    const angle = Math.PI + time % rotationPeriod / rotationPeriod * tau;
    return [Math.cos(angle), Math.sin(angle)];
  }

  const spin = ([x, y, z], [cos, sin]) => [x * cos + z * sin, y, -x * sin + z * cos];
  const placeForge = (point, turn) => spin(point, turn).map((value, i) => value * forgeScale + forgeCenter[i]);

  const metalLayer = document.createElement('canvas');
  const gl = metalLayer.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
  function makeRenderer() {
    if (!gl) return null;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
      gl.deleteShader(shader);
      return null;
    };
    const vert = compile(gl.VERTEX_SHADER, `
      attribute vec3 position;
      attribute vec3 normal;
      uniform float angle;
      uniform float forgeScale;
      uniform vec3 forgeCenter;
      uniform vec2 forgeTurn;
      uniform float cameraDistance;
      uniform vec3 shift;
      uniform vec4 camera;
      uniform vec4 stage;
      varying vec3 surface;
      varying vec3 location;
      vec3 spin(vec3 point) {
        return vec3(point.x * forgeTurn.x + point.z * forgeTurn.y, point.y, -point.x * forgeTurn.y + point.z * forgeTurn.x);
      }
      void main() {
        float c = cos(angle);
        float s = sin(angle);
        mat3 rotation = mat3(c,s,0., -s,c,0., 0.,0.,1.);
        vec3 local = rotation * position + shift;
        vec3 p = spin(local) * forgeScale + forgeCenter;
        float z = p.x * camera.y + p.z * camera.x;
        float depth = z * camera.z + p.y * camera.w;
        float perspective = 1. - depth / cameraDistance;
        vec2 screen = stage.xy * perspective + stage.zw * vec2(p.x * camera.x - p.z * camera.y, p.y * camera.z - z * camera.w);
        gl_Position = vec4(screen, -depth * .17, perspective);
        surface = spin(rotation * normal);
        location = position;
      }`);
    const frag = compile(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform vec3 material;
      uniform vec3 cameraEye;
      uniform float impact;
      varying vec3 surface;
      varying vec3 location;
      void main() {
        vec3 n = normalize(surface);
        vec3 key = normalize(vec3(-.46, .74, .49));
        vec3 eye = cameraEye;
        vec3 rim = normalize(vec3(.58, .39, -.75));
        float diffuse = max(dot(n, key), 0.);
        float fill = max(dot(n, normalize(vec3(.6, -.15, .55))), 0.);
        float gloss = pow(max(dot(n, normalize(key + eye)), 0.), 25.);
        float highlight = pow(max(dot(n, normalize(vec3(.12, .68, .73))), 0.), 70.);
        float rimLight = max(dot(n, rim), 0.);
        float brush = sin(location.y * 486. + location.x * 17.) * .017;
        vec3 shaded = material * (.31 + .86 * diffuse + .19 * fill + brush);
        shaded += vec3(.36, .40, .34) * gloss + vec3(.16, .18, .13) * highlight;
        shaded += vec3(.32, .44, .22) * rimLight * (.38 + impact * .20);
        gl_FragColor = vec4(min(shaded, vec3(1.)), 1.);
      }`);
    if (!vert || !frag) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);

    const position = gl.getAttribLocation(program, 'position');
    const normal = gl.getAttribLocation(program, 'normal');
    const uniform = (name) => gl.getUniformLocation(program, name);
    const modelAngle = uniform('angle');
    const shift = uniform('shift');
    const material = uniform('material');
    const impact = uniform('impact');
    const forgeRotation = uniform('forgeTurn');
    gl.enableVertexAttribArray(position);
    gl.enableVertexAttribArray(normal);
    gl.uniform1f(uniform('forgeScale'), forgeScale);
    gl.uniform3fv(uniform('forgeCenter'), forgeCenter);
    gl.uniform1f(uniform('cameraDistance'), cameraDistance);
    gl.uniform3fv(uniform('cameraEye'), cameraDirection);
    gl.uniform4f(uniform('camera'), cy, sy, cp, sp);
    gl.uniform4f(uniform('stage'), stage.x * 2 / stage.width - 1, 1 - stage.y * 2 / stage.height, stage.unit * 2 / stage.width, stage.unit * 2 / stage.height);

    const buffers = parts.map(({ triangles }) => {
      const buffer = gl.createBuffer();
      const vertices = triangles.flatMap(({ vertices, normal }) => vertices.flatMap((vertex) => [...vertex, ...normal]));
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      return buffer;
    });

    return (angle, anchor, bounce, flash, turn) => {
      gl.viewport(0, 0, metalLayer.width, metalLayer.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(impact, flash);
      gl.uniform2fv(forgeRotation, turn);
      parts.forEach(({ triangles, color }, i) => {
        gl.uniform1f(modelAngle, i < anvilPartCount ? 0 : angle);
        gl.uniform3fv(shift, i < anvilPartCount ? [0, bounce, 0] : anchor);
        gl.uniform3fv(material, color);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers[i]);
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 24, 12);
        gl.drawArrays(gl.TRIANGLES, 0, triangles.length * 3);
      });
      paint.drawImage(metalLayer, 0, 0, stage.width, stage.height);
    };
  }
  const renderMetal = makeRenderer();

  function renderMetalFallback(angle, anchor, bounce, turn) {
    const key = normalize([-.46, .74, .49]);
    const faces = parts.flatMap(({ triangles, color }, index) => {
      const rotation = index < anvilPartCount ? 0 : angle;
      const shift = index < anvilPartCount ? [0, bounce, 0] : anchor;
      return triangles.flatMap(({ vertices, normal }) => {
        const turned = spin(orient(normal, rotation, [0, 0, 0]), turn);
        const center = placeForge(orient(vertices[0], rotation, shift), turn);
        if (dot(turned, subtract(cameraPosition, center)) <= 0) return [];
        const points = vertices.map((point) => project(placeForge(orient(point, rotation, shift), turn)));
        const depth = points.reduce((sum, point) => sum + point.depth / 3, 0);
        const light = .40 + Math.max(0, dot(turned, key)) * .88;
        return [{ points, depth, color: 'rgb(' + color.map((value) => Math.round(value * light * 255)).join(',') + ')' }];
      });
    });
    faces.sort((a, b) => a.depth - b.depth);
    for (const face of faces) {
      const [a, b, c] = face.points;
      paint.beginPath();
      paint.moveTo(a.x, a.y);
      paint.lineTo(b.x, b.y);
      paint.lineTo(c.x, c.y);
      paint.closePath();
      paint.fillStyle = paint.strokeStyle = face.color;
      paint.lineWidth = .55;
      paint.stroke();
      paint.fill();
    }
  }

  function domePoint(latitude, azimuth) {
    const radius = Math.sin(latitude) * dome.radius;
    return [radius * Math.cos(azimuth), dome.height * Math.cos(latitude), radius * Math.sin(azimuth)];
  }

  function domeFacing(point) {
    const normal = [point[0] / dome.radius ** 2, point[1] / dome.height ** 2, point[2] / dome.radius ** 2];
    return dot(normal, subtract(cameraPosition, point));
  }

  const shellOutline = (() => {
    const points = [];
    for (let ring = 0; ring <= 24; ring++) {
      for (let step = 0; step < 72; step++) {
        points.push(project(domePoint(ring * Math.PI / 48, step * tau / 72)));
      }
    }
    points.sort((a, b) => a.x - b.x || a.y - b.y);
    const boundary = (ordered) => {
      const result = [];
      for (const point of ordered) {
        while (result.length > 1) {
          const a = result.at(-2);
          const b = result.at(-1);
          if ((b.x - a.x) * (point.y - a.y) > (b.y - a.y) * (point.x - a.x)) break;
          result.pop();
        }
        result.push(point);
      }
      return result.slice(0, -1);
    };
    return [...boundary(points), ...boundary(points.reverse())];
  })();

  const ringSizes = [1, 6, 9, 13, 16, 20, 24];
  const rings = ringSizes.map((count, row) => Array.from({ length: count }, (_, index) => {
    const jitter = Math.sin(index * 2.17 + row * 1.89);
    const latitude = row / (ringSizes.length - 1) * Math.PI / 2;
    const azimuth = (index + (row % 2) * .5 + jitter * .14) / count * tau + .22;
    const point = domePoint(latitude, azimuth);
    return { ...project(point), point, azimuth, facing: domeFacing(point), pulse: 0, accent: (index + row * 3) % 7 === 0 };
  }));
  const edges = rings.flatMap((ring, row) => row === 0 ? [] : ring.flatMap((node, i) => {
    const previous = [...rings[row - 1]].sort((a, b) => Math.cos(b.azimuth - node.azimuth) - Math.cos(a.azimuth - node.azimuth));
    const links = [[node, ring[(i + 1) % ring.length], 1], [node, previous[0], 1]];
    if (previous.length > 1 && (i + row) % 3 === 0) links.push([node, previous[1], .58]);
    return links;
  }));
  const nodes = rings.flat();
  const floor = project([forgeCenter[0], .03, forgeCenter[2]]);
  const sparks = [
    [-136,-80,.38],[142,-88,.43],[-77,-107,.37],[80,-158,.48],[-117,-48,.32],
    [39,-151,.40],[-44,-125,.41],[122,-48,.37],[66,-81,.48],[-94,-69,.47],[17,-104,.33],
  ];

  function line(a, b, color, weight) {
    paint.beginPath();
    paint.moveTo(a.x, a.y);
    paint.lineTo(b.x, b.y);
    paint.strokeStyle = color;
    paint.lineWidth = weight;
    paint.stroke();
  }

  function circle(x, y, radius, color) {
    paint.beginPath();
    paint.arc(x, y, radius, 0, tau);
    paint.fillStyle = color;
    paint.fill();
  }

  function glow(x, y, radius, color, alpha) {
    const fill = paint.createRadialGradient(x, y, 0, x, y, radius);
    fill.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
    fill.addColorStop(1, 'rgba(' + color + ',0)');
    circle(x, y, radius, fill);
  }

  function floorRing(radius, color, lineWidth, frontOnly = false) {
    paint.beginPath();
    for (let step = 0; step <= 64; step++) {
      const t = step / 64 * (frontOnly ? Math.PI : tau) - yaw;
      const point = project([radius * Math.cos(t), .015, radius * Math.sin(t)]);
      if (step === 0) paint.moveTo(point.x, point.y);
      else paint.lineTo(point.x, point.y);
    }
    paint.strokeStyle = color;
    paint.lineWidth = lineWidth;
    paint.stroke();
  }

  function wave(distance, time) {
    if (time < 0 || time > 1.1) return 0;
    const falloff = (distance - .25 - time * 4.3) / .34;
    return Math.exp(-(falloff ** 2)) * (1 - time / 1.25);
  }

  function renderNetwork(foreground) {
    for (const [a, b, weight] of edges) {
      if ((a.facing + b.facing > 0) !== foreground) continue;
      const pulse = (a.pulse + b.pulse) / 2;
      const alpha = ((foreground ? .29 : .095) + pulse * (foreground ? .48 : .24)) * weight;
      line(a, b, 'rgba(170,215,106,' + alpha + ')', .76 + pulse * .56);
    }
    for (const node of nodes) {
      if ((node.facing > 0) !== foreground) continue;
      const pulse = node.pulse;
      const alpha = (node.accent ? .80 : .48) * (foreground ? 1 : .45) + pulse * .42;
      if (foreground && (node.accent || pulse > .32)) glow(node.x, node.y, 7 + pulse * 8, '205,249,127', .13 + pulse * .32);
      circle(node.x, node.y, (node.accent ? 2 : 1.25) + pulse * .9, 'rgba(211,250,138,' + alpha + ')');
    }
  }

  function renderFloor(time) {
    paint.save();
    paint.translate(floor.x, floor.y + 4);
    paint.scale(1, .225);
    glow(0, 0, 125, '0,0,0', .84);
    paint.restore();
    floorRing(dome.radius, '#93b56829', .75);
    floorRing(2.41, '#93b56820', .65);
    if (time > .065 && time < .86) {
      const progress = easeOut((time - .065) / .795);
      floorRing(mix(.47, 2.65, progress), 'rgba(202,249,111,' + (1 - progress) * .59 + ')', 1.2);
    }
  }

  const shellPath = new Path2D();
  for (const [index, point] of shellOutline.entries()) {
    if (index === 0) shellPath.moveTo(point.x, point.y);
    else shellPath.lineTo(point.x, point.y);
  }
  shellPath.closePath();
  const shellTop = Math.min(...shellOutline.map((point) => point.y));
  const shellBottom = Math.max(...shellOutline.map((point) => point.y));
  const shellLeft = Math.min(...shellOutline.map((point) => point.x));
  const shellRight = Math.max(...shellOutline.map((point) => point.x));

  function renderDomeFront() {
    const glass = paint.createLinearGradient(shellLeft, shellTop, shellRight, shellBottom);
    glass.addColorStop(0, 'rgba(177,231,127,.23)');
    glass.addColorStop(.33, 'rgba(177,231,127,.065)');
    glass.addColorStop(.58, 'rgba(143,216,103,.025)');
    glass.addColorStop(1, 'rgba(177,231,127,.17)');
    paint.fillStyle = glass;
    paint.fill(shellPath);

    floorRing(dome.radius - .045, 'rgba(178,224,121,.32)', 1.15, true);

    const rim = paint.createLinearGradient(0, shellTop, 0, shellBottom);
    rim.addColorStop(0, 'rgba(214,253,158,.74)');
    rim.addColorStop(.61, 'rgba(154,205,97,.37)');
    rim.addColorStop(1, 'rgba(205,247,146,.79)');
    paint.strokeStyle = rim;
    paint.lineWidth = 1.3;
    paint.stroke(shellPath);
  }

  const forgeMarks = {
    cadrer: new Path2D('M8 3H4Q3 3 3 4V8 M16 3H20Q21 3 21 4V8 M21 16V20Q21 21 20 21H16 M8 21H4Q3 21 3 20V16 M8 9H16 M8 13H14 M8 17H12'),
    essayer: new Path2D('M5 4H19Q21 4 21 6V18Q21 20 19 20H5Q3 20 3 18V6Q3 4 5 4Z M3 8H21 M8 14L11 17L16 12'),
    deployer: new Path2D('M4 13V18Q4 20 6 20H18Q20 20 20 18V13 M12 4V15 M8 8L12 4L16 8'),
  };
  const projectGlyphs = [
    // Site web, outil, document, image, application, données, carte.
    new Path2D('M5 4H19Q21 4 21 6V18Q21 20 19 20H5Q3 20 3 18V6Q3 4 5 4Z M3 8H21 M7 12H17 M7 16H13'),
    new Path2D('M14 6L17 9L21 5A6 6 0 0 1 14 12L7 20A2.1 2.1 0 0 1 4 17L11 10A6 6 0 0 1 18 3Z'),
    new Path2D('M6 3H14L19 8V20Q19 21 18 21H6Q5 21 5 20V4Q5 3 6 3Z M14 3V8H19 M8 12H16 M8 16H16'),
    new Path2D('M5 4H19Q21 4 21 6V18Q21 20 19 20H5Q3 20 3 18V6Q3 4 5 4Z M3 17L8 12L13 17L16 14L21 19 M17 8A1.5 1.5 0 1 1 14 8A1.5 1.5 0 1 1 17 8Z'),
    new Path2D('M6 4H18Q20 4 20 6V18Q20 20 18 20H6Q4 20 4 18V6Q4 4 6 4Z M9 9L6.5 12L9 15 M15 9L17.5 12L15 15 M13 8L11 16'),
    new Path2D('M20 6C20 8 16.4 9 12 9S4 8 4 6 7.6 3 12 3 20 4 20 6Z M4 6V18C4 20 7.6 21 12 21S20 20 20 18V6 M4 12C4 14 7.6 15 12 15S20 14 20 12'),
    new Path2D('M12 21S18 15 18 10A6 6 0 0 0 6 10C6 15 12 21 12 21Z M14 10A2 2 0 1 1 10 10A2 2 0 1 1 14 10Z'),
  ];
  const emblemLayouts = [
    [[-1, 0]],
    [[-1, 0], [1, 0]],
    [[-1, -1], [1, 0], [-1, 1]],
    [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  ];

  function pickEmblems() {
    const pool = [...projectGlyphs];
    const layout = emblemLayouts[Math.floor(Math.random() * emblemLayouts.length)];
    return layout.map(([side, slot], index) => {
      const [glyph] = pool.splice(Math.floor(Math.random() * pool.length), 1);
      return { glyph, side, slot, delay: .04 + index * .068 };
    });
  }

  function strokeMark(context, glyph, color) {
    context.lineWidth = 1.7;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.strokeStyle = color;
    context.stroke(glyph);
  }

  function renderMethodMarks() {
    for (const mark of document.querySelectorAll('canvas[data-forge-mark]')) {
      const context = mark.getContext('2d');
      if (!context) continue;
      context.setTransform(mark.width / 24, 0, 0, mark.height / 24, 0, 0);
      strokeMark(context, forgeMarks[mark.dataset.forgeMark], '#41572f');
    }
  }

  const projectLayouts = [
    [[-52, -15, 104, 20], [-52, 11, 33, 13], [-14, 11, 29, 13], [20, 11, 32, 13]],
    [[-52, -15, 39, 39], [-5, -12, 57, 6], [-5, 0, 49, 6], [-5, 12, 31, 6]],
    [[-52, -15, 28, 39], [-16, -12, 67, 5], [-16, -1, 67, 4], [-16, 10, 52, 4]],
    [[-52, -15, 69, 39], [24, -15, 28, 17], [24, 6, 28, 18]],
    [[-52, -15, 20, 39], [-24, -15, 76, 11], [-24, 2, 34, 22], [15, 2, 37, 22]],
    [[-52, -15, 104, 8], [-52, -2, 47, 10], [0, -2, 52, 10], [-52, 13, 47, 10], [0, 13, 52, 10]],
    [[-52, -15, 71, 39], [25, -13, 27, 8], [25, 0, 27, 8], [25, 13, 18, 8]],
  ];

  function plaque(x, y, width, height, radius, fill, stroke) {
    paint.beginPath();
    paint.roundRect(x, y, width, height, radius);
    if (fill) {
      paint.fillStyle = fill;
      paint.fill();
    }
    if (stroke) {
      paint.lineWidth = 1;
      paint.strokeStyle = stroke;
      paint.stroke();
    }
  }

  function detailGlyph(glyph, x, y, size, color) {
    paint.save();
    paint.translate(x - size / 2, y - size / 2);
    paint.scale(size / 24, size / 24);
    strokeMark(paint, glyph, color);
    paint.restore();
  }

  function renderModules(time, hit, emblems, target) {
    for (const { glyph, side, slot, delay } of emblems) {
      const age = time - delay;
      if (age <= 0 || age > .95) continue;
      const travel = easeOut(clamp(age / .69));
      const bend = Math.sin(travel * Math.PI);
      const x = mix(hit.x, target.x + side * 57 * target.scale, travel) + side * 63 * bend;
      const y = mix(hit.y, target.y + slot * 24 * target.scale, travel) - 13 * bend;
      const visibility = easeOut(clamp(age / .14)) * (1 - ease(clamp((age - .56) / .39)));
      const step = mix(.55, 1, easeOut(clamp(age / .23)));

      paint.save();
      paint.translate(x, y);
      paint.scale(step, step);
      paint.globalAlpha = visibility;
      plaque(-14, -14, 28, 28, 5, '#141d16', '#b8ee789e');
      detailGlyph(glyph, 0, 0, 16, '#eeffce');
      paint.restore();
    }
  }

  function craftStage(event, time, hitIndex) {
    const first = event.strikes[0];
    const last = event.strikes.at(-1);
    const entrance = ease(clamp((time - first.at + 450) / 450));
    const elapsed = (time - last.at) / 1000;
    const final = hitIndex === event.strikes.length - 1;
    const progress = hitIndex < 0 ? 0 : (hitIndex + easeOut(clamp((time - event.strikes[hitIndex].at) / 420))) / event.strikes.length;
    return {
      entrance,
      progress,
      visibility: entrance * ease(clamp((event.end - time) / 400)),
      scan: final ? clamp((elapsed - .40) / .42) : 0,
      fault: final ? ease(clamp((elapsed - .60) / .14)) * (1 - ease(clamp((elapsed - .88) / .24))) : 0,
      fit: final ? ease(clamp((elapsed - .82) / .28)) : 0,
      verified: final ? ease(clamp((elapsed - 1.10) / .22)) : 0,
      release: final ? easeOut(clamp((elapsed - 1.27) / .36)) : 0,
    };
  }

  function craftPosition(origin, state) {
    return {
      x: mix(origin.x, stage.x, state.entrance),
      y: mix(origin.y - 7, 140, state.entrance) - 6 * state.release,
      scale: mix(.51, 1.26, state.entrance) + .05 * state.release,
    };
  }

  function renderCraft(event, position, state) {
    if (state.visibility <= 0) return;
    const lime = '#daff9a';
    const panel = projectLayouts[event.product];
    paint.save();
    paint.translate(position.x, position.y);
    paint.scale(position.scale, position.scale);
    paint.globalAlpha = state.visibility;
    paint.rotate(-.048 * (1 - state.release));
    glow(0, 0, 88, '142,246,79', .105 + .11 * state.verified);

    plaque(-65, -44, 130, 88, 7,
      'rgba(13,22,17,' + (.51 + state.progress * .35 + state.verified * .12) + ')',
      state.verified > .5 ? '#ceff9ee3' : '#b6ee83a3');
    line({ x: -64, y: -25 }, { x: 64, y: -25 }, '#a9de7a59', 1);
    for (let index = 0; index < 3; index++) circle(-54 + index * 6, -34, 1.5, '#adcf87b0');
    detailGlyph(projectGlyphs[event.product], 50, -34, 12, '#def3bd');

    for (const [index, [x, y, width, height]] of panel.entries()) {
      const installed = ease(clamp(state.progress * panel.length - index));
      const nudge = (1 - installed) * (index % 2 ? 11 : -11);
      plaque(x, y, width, height, 2, null, '#98c57559');
      if (installed > 0) {
        plaque(x + nudge, y - (1 - installed) * 5, width, height, 2,
          'rgba(179,239,124,' + installed * (index === 0 ? .28 + .24 * state.release : .16 + .14 * state.release) + ')',
          'rgba(192,244,142,' + installed * (.53 + .15 * state.release) + ')');
      }
    }

    if (state.progress < .98) {
      for (const side of [-1, 1]) for (const edge of [-1, 1]) {
        const corner = { x: side * 71, y: edge * 50 };
        line(corner, { x: side * 62, y: corner.y }, lime, .8);
        line(corner, { x: corner.x, y: edge * 41 }, lime, .8);
      }
    }

    if (state.progress > .18) {
      const displacement = 15 * (1 - state.fit);
      plaque(-52, 30, 59, 6, 2, null, '#a3cc696e');
      plaque(-52 + displacement, 30, 59, 6, 2, '#c2e8913c',
        state.fault > .08 ? '#ffa292' : '#a9e77e9e');
    }

    if (state.scan > 0 && state.scan < 1) {
      const scanY = mix(-24, 42, state.scan);
      paint.save();
      paint.globalAlpha *= Math.sin(Math.PI * state.scan);
      plaque(-63, scanY - 5, 126, 8, 2, '#a9fb7057');
      line({ x: -65, y: scanY }, { x: 65, y: scanY }, '#edffd1', 1.6);
      paint.restore();
    }

    if (state.fault > 0) {
      paint.save();
      paint.globalAlpha *= state.fault;
      circle(43, 32, 9.5, '#4d2424');
      line({ x: 39, y: 28 }, { x: 47, y: 36 }, '#ffad9f', 1.7);
      line({ x: 47, y: 28 }, { x: 39, y: 36 }, '#ffad9f', 1.7);
      paint.restore();
    }

    if (state.verified > 0) {
      paint.save();
      paint.globalAlpha *= state.verified;
      circle(43, 32, 9.5, '#283d20');
      line({ x: 38, y: 32 }, { x: 42, y: 36 }, lime, 1.7);
      line({ x: 42, y: 36 }, { x: 48, y: 29 }, lime, 1.7);
      paint.restore();
    }

    if (state.release > 0) {
      for (const [side, glyph] of [[-1, projectGlyphs[2]], [1, forgeMarks.deployer]]) {
        const x = side * mix(55, 93, state.release);
        paint.save();
        paint.globalAlpha *= state.release;
        line({ x: side * 65, y: 17 }, { x, y: 17 }, '#c4f79285', 1);
        plaque(x - 12, 5, 24, 24, 5, '#17251b', '#a8d779a7');
        detailGlyph(glyph, x, 17, 15, '#e8fec4');
        paint.restore();
      }
    }
    paint.restore();
  }

  function renderImpactFlash(time, hit) {
    if (time < 0 || time > .34) return;
    const flare = Math.exp(-time * 16);
    glow(hit.x, hit.y, 81, '181,251,79', .57 * flare);
    glow(hit.x, hit.y, 31, '240,255,195', .92 * flare);
    circle(hit.x, hit.y, 2.4 + 4 * flare, 'rgba(250,255,230,' + .9 * flare + ')');

    const expansion = easeOut(time / .34);
    const radius = mix(5, 65, expansion);
    paint.beginPath();
    paint.ellipse(hit.x, hit.y, radius, radius * .29, -.09, 0, tau);
    paint.strokeStyle = 'rgba(225,255,157,' + (1 - expansion) * .91 + ')';
    paint.lineWidth = 1.35;
    paint.stroke();
  }
  function renderSparks(time, hit) {
    if (time < 0 || time > .53) return;
    for (const [vx, vy, life] of sparks) {
      if (time > life) continue;
      const fade = (1 - time / life) ** 1.45;
      const path = (t) => ({ x: hit.x + vx * t, y: hit.y + vy * t + 150 * t ** 2 });
      const tip = path(time);
      line(path(Math.max(0, time - .052)), tip, 'rgba(203,249,119,' + fade * .88 + ')', 1.35);
      circle(tip.x, tip.y, .75 + fade * .65, 'rgba(248,255,217,' + fade + ')');
    }
  }

  const poses = [
    { time: 0, angle: -.77, x: .93, y: 1.83 },
    { time: 196, angle: -.87, x: .94, y: 1.835, curve: ease },
    { time: strike, angle: 0, x: .86, y: 1.82, curve: (progress) => progress ** 2.5 },
    { time: strike + contactHold, angle: 0, x: .86, y: 1.82, curve: ease },
    { time: 635, angle: -.23, x: .87, y: 1.837, curve: easeOut },
    { time: 798, angle: -.19, x: .88, y: 1.82, curve: ease },
    { time: 1430, angle: -.22, x: .91, y: 1.70, curve: ease },
  ];

  function hammerPose(time) {
    const index = poses.findIndex((pose) => pose.time >= time);
    if (index <= 0) {
      const pose = index === 0 ? poses[0] : poses.at(-1);
      return { angle: pose.angle, anchor: [pose.x, pose.y, contact[2]] };
    }
    const before = poses[index - 1];
    const after = poses[index];
    const progress = after.curve((time - before.time) / (after.time - before.time));
    return {
      angle: mix(before.angle, after.angle, progress),
      anchor: [mix(before.x, after.x, progress), mix(before.y, after.y, progress), contact[2]],
    };
  }

  const flightLength = 2050;
  const wallTouch = 1000;
  const restPose = hammerPose(1430);
  const raisePose = hammerPose(0);
  const hammerBalance = [-.78, -.04, 0];
  const hammerVertices = [...new Map(parts.slice(anvilPartCount)
    .flatMap((part) => part.triangles.flatMap((triangle) => triangle.vertices))
    .map((vertex) => [vertex.join(','), subtract(vertex, hammerBalance)])).values()];
  const cameraRight = [cy, 0, -sy];
  const cameraForward = [sy, 0, cy];

  const reboundTime = 155;
  const reboundPose = hammerPose(strike + reboundTime);
  const tapPose = { angle: -.54, anchor: [.91, 1.835, contact[2]] };

  function makeCycle(start, first = false) {
    const takeoff = start + (first ? 280 : mix(330, 1580, Math.random()));
    const strikeStart = takeoff + flightLength;
    const strikeCount = 1 + Math.floor(Math.random() * 3);
    const strikes = [];
    let at = strikeStart + strike;

    for (let index = 0; index < strikeCount; index++) {
      const gap = index + 1 < strikeCount ? mix(625, 1120, Math.random()) : 1400;
      strikes.push({
        at,
        offset: mix(-.13, .15, Math.random()),
        emblems: pickEmblems(),
        emblemPace: Math.min(1, gap / 1400),
      });
      at += gap;
    }

    return {
      start,
      takeoff,
      side: Math.random() < .5 ? -1 : 1,
      wallHeight: mix(1.63, 1.72, Math.random()),
      wallDepth: mix(.52, .66, Math.random()),
      strikeStart,
      strikes,
      product: Math.floor(Math.random() * projectLayouts.length),
      end: strikes.at(-1).at + mix(2350, 2850, Math.random()),
    };
  }

  function blendPose(from, to, progress) {
    return {
      angle: mix(from.angle, to.angle, progress),
      anchor: from.anchor.map((value, index) => mix(value, to.anchor[index], progress)),
    };
  }

  function strikingPose(event, time, previous, next) {
    if (time < event.strikeStart) return { angle: restPose.angle, anchor: [...restPose.anchor] };

    let pose;
    let offset;
    if (!previous) {
      const phase = time - event.strikeStart;
      pose = hammerPose(phase);
      offset = next.offset * ease(clamp((phase - 120) / 300));
    } else {
      const elapsed = time - previous.at;
      if (!next || elapsed <= reboundTime) {
        pose = hammerPose(strike + elapsed);
        offset = previous.offset * (1 - ease(clamp((elapsed - 185) / 610)));
      } else {
        const progress = (elapsed - reboundTime) / (next.at - previous.at - reboundTime);
        pose = progress < .58
          ? blendPose(reboundPose, tapPose, ease(progress / .58))
          : blendPose(tapPose, hammerPose(strike), ((progress - .58) / .42) ** 2.3);
        offset = mix(previous.offset, next.offset, ease(progress));
      }
    }
    pose.anchor[0] += offset;
    return pose;
  }

  let cycle = makeCycle(0, true);

  function cycleFor(time) {
    if (time < cycle.start) cycle = makeCycle(0, true);
    if (time - cycle.end > 60000) cycle = makeCycle(time);
    while (time >= cycle.end) cycle = makeCycle(cycle.end);
    return cycle;
  }

  function boundaryPose(event, angle, turn) {
    const base = cameraForward.map((value, i) => value * event.wallDepth + (i === 1 ? event.wallHeight : 0));
    const direction = cameraRight.map((value) => value * event.side);
    const horizontalLimit = dome.radius ** 2;
    let reach = Infinity;
    let lastVertex;
    for (const vertex of hammerVertices) {
      const offset = spin(orient(vertex, angle, [0, 0, 0]), turn);
      const point = offset.map((coordinate, i) => base[i] + coordinate * forgeScale);
      const projected = dot(point, direction);
      const radius = horizontalLimit * (1 - (point[1] / dome.height) ** 2);
      const across = point[0] ** 2 + point[2] ** 2 - projected ** 2;
      const limit = Math.sqrt(Math.max(0, radius - across)) - projected;
      if (limit < reach) {
        reach = limit;
        lastVertex = point;
      }
    }
    const center = base.map((value, i) => value + direction[i] * reach);
    const point = lastVertex.map((value, i) => value + direction[i] * reach);
    return { center, point };
  }

  function flightAngle(event, age) {
    const collisionAngle = event.side > 0 ? .78 : .58;
    if (age <= wallTouch) {
      return mix(restPose.angle, collisionAngle, ease(clamp((age - 160) / (wallTouch - 160))));
    }
    const progress = (age - wallTouch) / (flightLength - wallTouch);
    const recoil = Math.sin(progress * Math.PI) * (1 - progress) * .25;
    return mix(collisionAngle, raisePose.angle, ease(progress)) + recoil;
  }

  function wallContact(event) {
    if (!event.boundary) {
      const angle = flightAngle(event, wallTouch);
      const turn = forgeTurn(event.takeoff + wallTouch);
      event.boundary = boundaryPose(event, angle, turn);
    }
    return event.boundary;
  }

  function airbornePose(event, now, turn) {
    const age = now - event.takeoff;
    const angle = flightAngle(event, age);
    const returning = age > wallTouch;
    const boundary = wallContact(event).center;
    const target = returning ? raisePose : restPose;
    const home = placeForge(orient(hammerBalance, target.angle, target.anchor), turn);
    const progress = returning ? (age - wallTouch) / (flightLength - wallTouch) : age / wallTouch;
    const travel = returning ? (1 - progress) ** 2.2 : progress ** 2 * (2 - progress);
    const mass = home.map((value, i) => mix(value, boundary[i], travel));
    const lift = Math.sin(Math.PI * progress) ** 2;
    mass[1] += lift * (returning ? .075 : .14);

    const relative = subtract(mass, forgeCenter).map((value) => value / forgeScale);
    const localMass = spin(relative, [turn[0], -turn[1]]);
    const balance = orient(hammerBalance, angle, [0, 0, 0]);
    return { angle, anchor: subtract(localMass, balance) };
  }

  function renderWallDischarge(time, contact) {
    if (time < 0 || time > .53) return;
    const point = project(contact);
    const alpha = Math.exp(-time * 7);
    glow(point.x, point.y, 43, '190,255,124', .68 * alpha);
    circle(point.x, point.y, 2.4 + alpha * 2.4, 'rgba(248,255,220,' + alpha + ')');
    const nearest = nodes.slice().sort((a, b) => Math.hypot(...subtract(a.point, contact)) - Math.hypot(...subtract(b.point, contact))).slice(0, 3);
    for (const [index, node] of nearest.entries()) {
      if (time < index * .026) continue;
      const step = mix(.62, 1, easeOut(clamp(time / .14)));
      const tip = { x: mix(point.x, node.x, step), y: mix(point.y, node.y, step) };
      const bend = {
        x: mix(point.x, tip.x, .48) + Math.sin(time * 32 + index * 6) * 5,
        y: mix(point.y, tip.y, .48) + Math.cos(time * 28 + index * 4) * 5,
      };
      const light = 'rgba(228,255,178,' + .9 * alpha + ')';
      line(point, bend, light, 1.35);
      line(bend, tip, light, 1.15);
    }
  }

  let ratio = 1;
  let width = 0;
  let height = 0;
  let frame = 0;
  let visible = false;
  let startedAt = null;
  let pausedAt = null;

  function render(time) {
    if (!width || !height) return;
    const scale = Math.min(width / stage.width, height / stage.height);
    paint.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint.clearRect(0, 0, width, height);
    paint.translate((width - stage.width * scale) / 2, (height - stage.height * scale) / 2);
    paint.scale(scale, scale);

    const event = cycleFor(time);
    const turn = forgeTurn(time);
    const lastIndex = event.strikes.findLastIndex((hit) => hit.at <= time);
    const previous = event.strikes[lastIndex];
    const next = event.strikes[lastIndex + 1];
    const sinceStrike = previous ? time - previous.at : -1;
    const elapsed = sinceStrike / 1000;
    const wallTime = (time - event.takeoff - wallTouch) / 1000;
    const discharge = wallTime >= 0 && wallTime < 1.1 ? wallContact(event).point : null;
    const impact = previous && placeForge([contact[0] + previous.offset, contact[1], contact[2]], forgeTurn(previous.at));
    const flash = previous ? Math.exp(-elapsed * 10) : 0;
    const bounce = -.012 * Math.sin(Math.PI * clamp(sinceStrike / contactHold));
    const flying = time >= event.takeoff && time < event.strikeStart;
    const { angle, anchor } = flying ? airbornePose(event, time, turn) : strikingPose(event, time, previous, next);
    anchor[1] += bounce;

    for (const node of nodes) {
      const impactPulse = impact && elapsed <= 1.1
        ? wave(Math.hypot(...subtract(node.point, impact)), elapsed)
        : 0;
      const wallPulse = discharge ? wave(Math.hypot(...subtract(node.point, discharge)), wallTime) : 0;
      node.pulse = Math.max(impactPulse, wallPulse);
    }
    renderNetwork(false);
    renderFloor(elapsed);
    if (renderMetal && !gl.isContextLost()) renderMetal(angle, anchor, bounce, flash, turn);
    else renderMetalFallback(angle, anchor, bounce, turn);
    if (impact) {
      const hit = project(impact);
      renderImpactFlash(elapsed, hit);
      renderSparks(elapsed, hit);
    }
    const state = craftStage(event, time, lastIndex);
    if (state.visibility > 0) {
      const origin = project(placeForge(contact, forgeTurn(event.strikes[0].at)));
      const position = craftPosition(origin, state);
      renderCraft(event, position, state);
      if (impact) renderModules(elapsed / previous.emblemPace, project(impact), previous.emblems, position);
    }
    renderDomeFront();
    renderNetwork(true);
    if (discharge) {
      paint.save();
      paint.clip(shellPath);
      renderWallDischarge(wallTime, discharge);
      paint.restore();
    }
  }

  function sceneTime(now) {
    if (startedAt === null) return 0;
    return Math.max(0, (pausedAt ?? now) - startedAt);
  }

  function scheduleFrame() {
    if (frame || !visible || reduced.matches || pausedAt !== null) return;
    startedAt ??= performance.now();
    frame = requestAnimationFrame(tick);
  }

  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function tick(now) {
    frame = 0;
    render(sceneTime(now));
    scheduleFrame();
  }

  function renderToggle() {
    const paused = pausedAt !== null;
    toggle.textContent = paused ? 'Reprendre' : 'Pause';
    toggle.setAttribute('aria-label', paused ? 'Reprendre l’animation' : 'Mettre l’animation en pause');
  }

  function toggleMotion() {
    if (reduced.matches || startedAt === null) return;
    const now = performance.now();
    if (pausedAt === null) {
      pausedAt = now;
      stopFrame();
      render(sceneTime(now));
    } else {
      startedAt += now - pausedAt;
      pausedAt = null;
      scheduleFrame();
    }
    renderToggle();
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    ratio = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const scale = Math.min(width / stage.width, height / stage.height) * ratio;
    metalLayer.width = Math.max(1, Math.round(stage.width * scale));
    metalLayer.height = Math.max(1, Math.round(stage.height * scale));
    render(sceneTime(performance.now()));
  }

  function syncMotionPreference() {
    toggle.hidden = reduced.matches;
    if (reduced.matches) {
      stopFrame();
      startedAt = null;
      pausedAt = null;
      renderToggle();
      render(0);
    } else {
      scheduleFrame();
    }
  }

  renderMethodMarks();
  art.classList.add('has-canvas');
  resize();
  syncMotionPreference();
  new ResizeObserver(resize).observe(canvas);
  reduced.addEventListener('change', syncMotionPreference);
  toggle.addEventListener('click', toggleMotion);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) scheduleFrame();
    else stopFrame();
  });
  visibility.observe(canvas);
})();
