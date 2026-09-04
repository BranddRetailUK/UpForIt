(function upforitVisualsBridge() {
  var resultPath = typeof UPFORIT_RESULT_PATH !== "undefined" ? UPFORIT_RESULT_PATH : "";
  var projectWasCreated = false;

  function parseJson(text) {
    return eval("(" + text + ")");
  }

  function quoteJsonString(value) {
    return '"' + String(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t") + '"';
  }

  function stringifyJson(value) {
    if (value === null) return "null";
    var kind = typeof value;
    if (kind === "string") return quoteJsonString(value);
    if (kind === "number") return isFinite(value) ? String(value) : "null";
    if (kind === "boolean") return value ? "true" : "false";
    if (value instanceof Array) {
      var entries = [];
      for (var arrayIndex = 0; arrayIndex < value.length; arrayIndex += 1) {
        entries.push(typeof value[arrayIndex] === "undefined" ? "null" : stringifyJson(value[arrayIndex]));
      }
      return "[" + entries.join(",") + "]";
    }
    if (kind === "object") {
      var properties = [];
      for (var key in value) {
        if (value.hasOwnProperty(key) && typeof value[key] !== "undefined" && typeof value[key] !== "function") {
          properties.push(quoteJsonString(key) + ":" + stringifyJson(value[key]));
        }
      }
      return "{" + properties.join(",") + "}";
    }
    return "null";
  }

  function readText(filePath) {
    var file = new File(filePath);
    if (!file.exists) throw new Error("Bridge input does not exist: " + filePath);
    if (!file.open("r")) throw new Error("Unable to open bridge input: " + filePath);
    var text = file.read();
    file.close();
    return text;
  }

  function writeJson(filePath, value) {
    var file = new File(filePath);
    if (!file.open("w")) throw new Error("Unable to write bridge result: " + filePath);
    file.encoding = "UTF-8";
    file.write(stringifyJson(value));
    file.close();
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function motionValue(job, name, fallback) {
    var value = job && job.motion ? job.motion[name] : null;
    return typeof value === "number" && isFinite(value) ? value : fallback;
  }

  function intensityEnergy(job) {
    var intensity = Math.round(clamp(motionValue(job, "intensity", 3), 1, 5));
    return [0, 0.9, 1.15, 1.5, 1.95, 2.5][intensity];
  }

  function glitchAmount(job) {
    return clamp(motionValue(job, "glitchAmount", 62), 0, 100);
  }

  function logoInstanceCount(job) {
    return Math.round(clamp(motionValue(job, "logoCopies", 4), 1, 6));
  }

  function visualStyle(job) {
    var style = job && job.motion ? job.motion.stylePreset : "website";
    return style === "neon" || style === "spline" ? style : "website";
  }

  function visualStyleIndex(job) {
    var style = visualStyle(job);
    return style === "neon" ? 2 : style === "spline" ? 3 : 1;
  }

  function hasLogo(job) {
    return Boolean(job && job.brand && job.brand.logoAssetId !== "none");
  }

  function stylePalette(job) {
    var style = visualStyle(job);
    if (style === "neon") {
      return {
        primary: [0.02, 0.86, 1],
        secondary: [1, 0, 0.62],
        accent: [0.46, 0.04, 1],
        highlight: [0.86, 0.98, 1]
      };
    }
    if (style === "spline") {
      return {
        primary: [0.08, 0.7, 1],
        secondary: [1, 0.9, 0.08],
        accent: [0.94, 0.02, 0.48],
        highlight: [0.92, 0.98, 1]
      };
    }
    return {
      primary: [0, 0.557, 0.941],
      secondary: [1, 0.875, 0],
      accent: [0.851, 0, 0.384],
      highlight: [1, 1, 1]
    };
  }

  function addGlow(layer, radius, intensity) {
    try {
      var glow = layer.property("ADBE Effect Parade").addProperty("ADBE Glo2");
      glow.property(3).setValue(radius);
      glow.property(6).setValue(intensity);
      return glow;
    } catch (ignoreGlowEffect) {
      return null;
    }
  }

  function addFastBlur(layer, radius) {
    try {
      var blur = layer.property("ADBE Effect Parade").addProperty("ADBE Box Blur2");
      blur.property(1).setValue(radius);
      blur.property(3).setValue(true);
      return blur;
    } catch (ignoreBlurEffect) {
      return null;
    }
  }

  function wantsLayout(job, layout) {
    if (!job || !job.content || job.content.kind !== "artist_batch") return false;
    for (var index = 0; index < job.content.layouts.length; index += 1) {
      if (job.content.layouts[index] === layout) return true;
    }
    return false;
  }

  function pad(value, length) {
    var output = String(value);
    while (output.length < length) output = "0" + output;
    return output;
  }

  function safeSlug(value, fallbackIndex) {
    var slug = String(value).toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9]+/g, "_");
    slug = slug.replace(/^_+|_+$/g, "").substring(0, 60);
    return slug || "ARTIST_" + pad(fallbackIndex, 2);
  }

  function uniqueSlugs(names) {
    var used = {};
    var output = [];
    for (var index = 0; index < names.length; index += 1) {
      var base = safeSlug(names[index], index + 1);
      used[base] = (used[base] || 0) + 1;
      output.push(used[base] === 1 ? base : base + "_" + used[base]);
    }
    return output;
  }

  function splitArtistName(name) {
    var display = String(name).toUpperCase();
    if (display.length <= 24 || display.indexOf(" ") === -1) return display;
    var words = display.split(" ");
    var best = 1;
    var smallest = 99999;
    for (var index = 1; index < words.length; index += 1) {
      var left = words.slice(0, index).join(" ").length;
      var right = words.slice(index).join(" ").length;
      var difference = Math.abs(left - right);
      if (difference < smallest) {
        smallest = difference;
        best = index;
      }
    }
    return words.slice(0, best).join(" ") + "\r" + words.slice(best).join(" ");
  }

  function addFolder(name, parent) {
    var folder = app.project.items.addFolder(name);
    if (parent) folder.parentFolder = parent;
    return folder;
  }

  function addSlider(layer, name, value) {
    var effect = layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    effect.name = name;
    effect.property(1).setValue(value);
    return effect.property(1);
  }

  function addColor(layer, name, value) {
    var effect = layer.property("ADBE Effect Parade").addProperty("ADBE Color Control");
    effect.name = name;
    effect.property(1).setValue(value);
    return effect.property(1);
  }

  function makeControlsComp(job, parentFolder) {
    var comp = app.project.items.addComp("00_CONTROLS", 640, 360, 1, job.canvas.durationSeconds, job.canvas.fps);
    comp.parentFolder = parentFolder;
    var controller = comp.layers.addNull();
    controller.name = "UPFORIT_CONTROLS";
    addSlider(controller, "Intensity", job.motion.intensity);
    addSlider(controller, "Camera Strength", job.motion.cameraStrength);
    addSlider(controller, "Depth Speed", job.motion.depthSpeed);
    addSlider(controller, "Logo Scale", job.motion.logoScale);
    addSlider(controller, "Light Sweeps", job.motion.lightSweepAmount);
    addSlider(controller, "Particles", job.motion.particleAmount);
    addSlider(controller, "Glitch Amount", glitchAmount(job));
    addSlider(controller, "Logo Instances", logoInstanceCount(job));
    addSlider(controller, "Style Preset (1 Website / 2 Neon / 3 Spline)", visualStyleIndex(job));
    addColor(controller, "UPFORIT Blue", [0, 0.557, 0.941]);
    addColor(controller, "UPFORIT Yellow", [1, 0.875, 0]);
    addColor(controller, "UPFORIT Pink", [0.851, 0, 0.384]);
    return comp;
  }

  function makeSharedUtilityComp(name, job, parentFolder) {
    var comp = app.project.items.addComp(name, job.canvas.width, job.canvas.height, 1, job.canvas.durationSeconds, job.canvas.fps);
    comp.parentFolder = parentFolder;
    var controls = comp.layers.addNull();
    controls.name = name + "_CONTROLS";
    controls.enabled = false;
    if (name === "FLASH_CLOCK") addSlider(controls, "Combined Flash", 0);
    if (name === "CAMERA_RIG") addSlider(controls, "Camera Strength", job.motion.cameraStrength);
    return comp;
  }

  function addCircle(comp, name, diameter, color, position, opacity, phase, drift, energy) {
    var layer = comp.layers.addShape();
    layer.name = name;
    layer.motionBlur = true;
    var root = layer.property("ADBE Root Vectors Group");
    var group = root.addProperty("ADBE Vector Group");
    var vectors = group.property("ADBE Vectors Group");
    var ellipse = vectors.addProperty("ADBE Vector Shape - Ellipse");
    ellipse.property("ADBE Vector Ellipse Size").setValue([diameter, diameter]);
    var fill = vectors.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(color);
    layer.property("ADBE Transform Group").property("ADBE Position").setValue(position);
    layer.property("ADBE Transform Group").property("ADBE Opacity").setValue(opacity);
    layer.property("ADBE Transform Group").property("ADBE Position").expression =
      "var a=2*Math.PI*time/thisComp.duration; value+[Math.sin(a+" + phase + ")*" + drift + "+Math.sin(2*a+" + phase + ")*" + drift * 0.32 + ",Math.cos(a+" + phase + ")*" + drift + "+Math.sin(3*a+" + phase + ")*" + drift * 0.2 + "];";
    layer.property("ADBE Transform Group").property("ADBE Scale").expression =
      "var a=2*Math.PI*time/thisComp.duration; var s=1+Math.sin(2*a+" + phase + ")*" + (0.18 * energy) + "; value*s;";
    layer.property("ADBE Transform Group").property("ADBE Rotate Z").expression =
      "var a=2*Math.PI*time/thisComp.duration; value+Math.sin(a+" + phase + ")*" + (32 * energy) + ";";
    return layer;
  }

  function makeBackground(job, sharedFolder) {
    var width = job.canvas.width;
    var height = job.canvas.height;
    var energy = intensityEnergy(job);
    var style = visualStyle(job);
    var depth = motionValue(job, "depthSpeed", 78);
    var palette = stylePalette(job);
    var comp = app.project.items.addComp("BG_HALFTONE", width, height, 1, job.canvas.durationSeconds, job.canvas.fps);
    comp.parentFolder = sharedFolder;
    comp.motionBlur = true;
    comp.shutterAngle = 180;
    var base = comp.layers.addSolid([0, 0, 0], "BLACK_BASE", width, height, 1, job.canvas.durationSeconds);

    // Broad, blurred colour fields create atmosphere without turning the
    // backdrop into a flat wallpaper. The main comp supplies true 3D depth.
    var washColors = [palette.primary, palette.accent, palette.secondary];
    var washPositions = [[0.18, 0.34], [0.82, 0.68], [0.52, 0.54]];
    for (var washIndex = 0; washIndex < washColors.length; washIndex += 1) {
      var wash = comp.layers.addShape();
      wash.name = "ATMOSPHERE_WASH_" + pad(washIndex + 1, 2);
      wash.blendingMode = BlendingMode.ADD;
      var washRoot = wash.property("ADBE Root Vectors Group");
      var washGroup = washRoot.addProperty("ADBE Vector Group");
      var washVectors = washGroup.property("ADBE Vectors Group");
      var washEllipse = washVectors.addProperty("ADBE Vector Shape - Ellipse");
      washEllipse.property("ADBE Vector Ellipse Size").setValue([
        width * (washIndex === 2 ? 0.72 : 0.46),
        height * (washIndex === 2 ? 0.3 : 0.58)
      ]);
      var washFill = washVectors.addProperty("ADBE Vector Graphic - Fill");
      washFill.property("ADBE Vector Fill Color").setValue(washColors[washIndex]);
      wash.property("ADBE Transform Group").property("ADBE Position").setValue([
        width * washPositions[washIndex][0],
        height * washPositions[washIndex][1]
      ]);
      wash.property("ADBE Transform Group").property("ADBE Opacity").setValue(
        style === "neon" ? 13 + energy * 2 : style === "spline" ? 8 + energy : 9 + energy * 1.4
      );
      wash.property("ADBE Transform Group").property("ADBE Position").expression =
        "var a=2*Math.PI*time/thisComp.duration;value+[Math.sin(a+" + washIndex * 2.1 + ")*thisComp.width*" + (0.045 * energy) + ",Math.cos(2*a+" + washIndex * 1.4 + ")*thisComp.height*" + (0.065 * energy) + "];";
      wash.property("ADBE Transform Group").property("ADBE Scale").expression =
        "var a=2*Math.PI*time/thisComp.duration;value*(1+Math.sin(a+" + washIndex + ")*" + (0.14 * energy) + ");";
      addFastBlur(wash, Math.round(width * 0.055));
    }

    // The website look retains its halftone DNA, but at texture level rather
    // than as the dominant object in the frame.
    var columns = style === "website" ? 14 : 9;
    var rows = style === "website" ? 8 : 5;
    for (var row = 0; row < rows; row += 1) {
      for (var column = 0; column < columns; column += 1) {
        var phase = (row * columns + column) * 0.37;
        addCircle(
          comp,
          "TEXTURE_DOT_" + pad(row * columns + column + 1, 3),
          Math.max(4, Math.round(width / 220)) * (1 + ((row + column) % 3) * 0.16),
          (row + column) % 5 === 0 ? palette.secondary : palette.primary,
          [width * (column + 0.5) / columns, height * (row + 0.5) / rows],
          style === "website" ? 7 + ((row + column) % 3) * 3 : 3 + ((row + column) % 2) * 2,
          phase,
          width * (0.004 + depth * 0.00008) * energy,
          energy * 0.35
        );
      }
    }

    var horizon = comp.layers.addSolid(
      palette.primary,
      "HORIZON_GLOW",
      Math.round(width * 1.4),
      Math.max(4, Math.round(height * 0.025)),
      1,
      comp.duration
    );
    horizon.blendingMode = BlendingMode.ADD;
    horizon.property("ADBE Transform Group").property("ADBE Position").setValue([width / 2, height * 0.54]);
    horizon.property("ADBE Transform Group").property("ADBE Opacity").expression =
      "var a=2*Math.PI*time/thisComp.duration;" + (6 + energy * 1.8) + "+Math.sin(2*a)*" + (3 * energy) + ";";
    horizon.property("ADBE Transform Group").property("ADBE Scale").expression =
      "var a=2*Math.PI*time/thisComp.duration;[100+Math.sin(a)*18,100+Math.cos(2*a)*55];";
    addFastBlur(horizon, Math.round(height * 0.035));

    var grain = comp.layers.addSolid([0, 0, 0], "FINE_GRAIN", width, height, 1, comp.duration);
    grain.blendingMode = BlendingMode.SCREEN;
    grain.property("ADBE Transform Group").property("ADBE Opacity").setValue(style === "website" ? 8 : 5);
    try {
      var noise = grain.property("ADBE Effect Parade").addProperty("ADBE Noise");
      noise.property(1).setValue(style === "website" ? 26 : 18);
    } catch (ignoreNoise) {}

    base.moveToEnd();
    return comp;
  }

  function importLogo(assetPath, assetsFolder) {
    var options = new ImportOptions(new File(assetPath));
    var footage = app.project.importFile(options);
    footage.name = "UPFORIT_LOGO_SOURCE";
    footage.parentFolder = assetsFolder;
    return footage;
  }

  function fitLogoLayer(layer, comp, targetWidthPercent) {
    var targetWidth = comp.width * targetWidthPercent / 100;
    var scale = targetWidth / layer.source.width * 100;
    layer.property("ADBE Transform Group").property("ADBE Scale").setValue([scale, scale, scale]);
  }

  function addFlashClock(comp, events, fps) {
    var clock = comp.layers.addNull();
    clock.name = "FLASH_CLOCK";
    clock.enabled = false;
    var flash = addSlider(clock, "Flash", 0);
    for (var index = 0; index < events.length; index += 1) {
      var at = events[index];
      flash.setValueAtTime(Math.max(0, at - 2 / fps), 0);
      flash.setValueAtTime(at, 100);
      flash.setValueAtTime(Math.min(comp.duration - 1 / fps, at + 3 / fps), 0);
    }
    return clock;
  }

  function addLookClock(comp, fps) {
    var clock = comp.layers.addNull();
    clock.name = "LOOK_CLOCK";
    clock.enabled = false;
    var look = addSlider(clock, "Look", 0);
    var lastFrame = Math.max(0, comp.duration - 1 / fps);
    var times = [0, comp.duration * 0.24, comp.duration * 0.49, comp.duration * 0.74, lastFrame];
    var values = [0, 1, 2, 3, 0];
    for (var index = 0; index < times.length; index += 1) {
      look.setValueAtTime(times[index], values[index]);
      try { look.setInterpolationTypeAtKey(index + 1, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD); } catch (ignoreLookHold) {}
    }
    return clock;
  }

  function addDimensionalStage(comp, job) {
    var style = visualStyle(job);
    var palette = stylePalette(job);
    var energy = intensityEnergy(job);
    var depthSpeed = motionValue(job, "depthSpeed", 78);
    var ringCount = style === "neon" ? 11 : style === "spline" ? 4 : 2;
    var colors = [palette.primary, palette.primary, palette.accent, palette.secondary];

    for (var index = 0; index < ringCount; index += 1) {
      var ring = comp.layers.addShape();
      ring.name = "DEPTH_PORTAL_" + pad(index + 1, 2);
      ring.threeDLayer = true;
      ring.motionBlur = true;
      ring.blendingMode = BlendingMode.ADD;
      var root = ring.property("ADBE Root Vectors Group");
      var group = root.addProperty("ADBE Vector Group");
      var vectors = group.property("ADBE Vectors Group");
      var path = vectors.addProperty("ADBE Vector Shape - Group");
      var halfWidth = comp.width * (style === "spline" ? 0.44 : 0.39);
      var halfHeight = comp.height * (style === "neon" ? 0.41 : 0.37);
      var frameShape = new Shape();
      frameShape.vertices = [
        [-halfWidth * 0.78, -halfHeight],
        [halfWidth * 0.78, -halfHeight],
        [halfWidth, -halfHeight * 0.62],
        [halfWidth, halfHeight * 0.62],
        [halfWidth * 0.78, halfHeight],
        [-halfWidth * 0.78, halfHeight],
        [-halfWidth, halfHeight * 0.62],
        [-halfWidth, -halfHeight * 0.62]
      ];
      frameShape.inTangents = [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]];
      frameShape.outTangents = [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]];
      frameShape.closed = true;
      path.property("ADBE Vector Shape").setValue(frameShape);

      var color = colors[index % colors.length];
      var halo = vectors.addProperty("ADBE Vector Graphic - Stroke");
      halo.property("ADBE Vector Stroke Color").setValue(color);
      halo.property("ADBE Vector Stroke Width").setValue(comp.height * (style === "neon" ? 0.018 : 0.012));
      halo.property("ADBE Vector Stroke Opacity").setValue(style === "neon" ? 12 : 8);
      var core = vectors.addProperty("ADBE Vector Graphic - Stroke");
      core.property("ADBE Vector Stroke Color").setValue(color);
      core.property("ADBE Vector Stroke Width").setValue(comp.height * (style === "neon" ? 0.0034 : 0.0024));
      core.property("ADBE Vector Stroke Opacity").setValue(style === "neon" ? 68 : 52);

      var phase = index / ringCount;
      var farZ = comp.width * (style === "spline" ? 1.6 : 1.9);
      var nearZ = -comp.width * 0.2;
      ring.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width / 2, comp.height / 2, farZ]);
      ring.property("ADBE Transform Group").property("ADBE Position").expression =
        "var u=(time/thisComp.duration*" + (0.72 + depthSpeed * 0.006) + "+" + phase + ")%1;var z=linear(u," + farZ + "," + nearZ + ");var a=2*Math.PI*time/thisComp.duration;[thisComp.width/2+Math.sin(a+" + index * 0.7 + ")*thisComp.width*" + (0.012 * energy) + ",thisComp.height/2+Math.cos(2*a+" + index * 0.5 + ")*thisComp.height*" + (0.012 * energy) + ",z];";
      ring.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "var u=(time/thisComp.duration*" + (0.72 + depthSpeed * 0.006) + "+" + phase + ")%1;var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var edge=Math.pow(Math.sin(Math.PI*u),.55);edge*" + (style === "neon" ? 48 : style === "spline" ? 34 : 39) + "*(l==0?1:l==1?0.72:l==2?1.18:0.54);";
      addGlow(ring, style === "neon" ? 44 : 28, style === "neon" ? 1.2 : 0.68);
    }

    // Converging rails anchor the composition to a shared vanishing point so
    // movement reads as a stage volume instead of independent floating planes.
    var railCount = style === "neon" ? 6 : style === "spline" ? 3 : 0;
    for (var railIndex = 0; railIndex < railCount; railIndex += 1) {
      var rail = comp.layers.addShape();
      rail.name = "PERSPECTIVE_RAIL_" + pad(railIndex + 1, 2);
      rail.blendingMode = BlendingMode.ADD;
      var railRoot = rail.property("ADBE Root Vectors Group");
      var railGroup = railRoot.addProperty("ADBE Vector Group");
      var railVectors = railGroup.property("ADBE Vectors Group");
      var railPath = railVectors.addProperty("ADBE Vector Shape - Group");
      var railShape = new Shape();
      var endX = comp.width * (-0.62 + railIndex * (1.24 / Math.max(1, railCount - 1)));
      railShape.vertices = [[0, comp.height * 0.03], [endX, comp.height * 0.6]];
      railShape.inTangents = [[0,0],[0,0]];
      railShape.outTangents = [[0,0],[0,0]];
      railShape.closed = false;
      railPath.property("ADBE Vector Shape").setValue(railShape);
      var railStroke = railVectors.addProperty("ADBE Vector Graphic - Stroke");
      railStroke.property("ADBE Vector Stroke Color").setValue(railIndex % 3 === 0 ? palette.accent : palette.primary);
      railStroke.property("ADBE Vector Stroke Width").setValue(comp.height * 0.0018);
      railStroke.property("ADBE Vector Stroke Opacity").setValue(style === "neon" ? 36 : 24);
      var railTrim = railRoot.addProperty("ADBE Vector Filter - Trim");
      railTrim.property("ADBE Vector Trim Start").setValue(0);
      railTrim.property("ADBE Vector Trim End").expression =
        "var a=2*Math.PI*time/thisComp.duration;55+45*Math.sin(a+" + railIndex * 0.8 + ")*Math.sin(a+" + railIndex * 0.8 + ");";
      rail.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width / 2, comp.height / 2, 0]);
      rail.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');l==3?35:(l==1?72:52);";
      addGlow(rail, 18, 0.55);
    }
  }

  function addWebsiteSurfaceField(comp, job) {
    var palette = stylePalette(job);
    var energy = intensityEnergy(job);
    var depthSpeed = motionValue(job, "depthSpeed", 78);
    var colors = [palette.primary, palette.secondary, palette.accent, palette.primary, palette.highlight];
    var panelCount = 12;

    // Large deforming slabs take their cue from the supplied LED/fabric loops.
    // They deliberately pass beyond the frame edges so this reads as a camera
    // moving through an environment, not a collection of floating cards.
    for (var index = 0; index < panelCount; index += 1) {
      var panel = comp.layers.addShape();
      panel.name = "WEBSITE_LED_SURFACE_" + pad(index + 1, 2);
      panel.threeDLayer = true;
      panel.motionBlur = true;
      var root = panel.property("ADBE Root Vectors Group");
      var group = root.addProperty("ADBE Vector Group");
      var vectors = group.property("ADBE Vectors Group");
      var rectangle = vectors.addProperty("ADBE Vector Shape - Rect");
      var panelWidth = comp.width * (0.14 + (index % 4) * 0.035);
      rectangle.property("ADBE Vector Rect Size").setValue([panelWidth, comp.height * (1.18 + (index % 3) * 0.18)]);
      rectangle.property("ADBE Vector Rect Roundness").setValue(comp.width * 0.008);
      var fill = vectors.addProperty("ADBE Vector Graphic - Fill");
      fill.property("ADBE Vector Fill Color").setValue(colors[index % colors.length]);
      fill.property("ADBE Vector Fill Opacity").setValue(index % 5 === 4 ? 22 : 64);
      var stroke = vectors.addProperty("ADBE Vector Graphic - Stroke");
      stroke.property("ADBE Vector Stroke Color").setValue(colors[(index + 2) % colors.length]);
      stroke.property("ADBE Vector Stroke Width").setValue(comp.height * (0.003 + (index % 3) * 0.0015));
      stroke.property("ADBE Vector Stroke Opacity").setValue(74);

      for (var ribIndex = 0; ribIndex < 3; ribIndex += 1) {
        var ribGroup = root.addProperty("ADBE Vector Group");
        var ribVectors = ribGroup.property("ADBE Vectors Group");
        var rib = ribVectors.addProperty("ADBE Vector Shape - Rect");
        rib.property("ADBE Vector Rect Size").setValue([panelWidth * (0.05 + ribIndex * 0.018), comp.height * 1.55]);
        var ribFill = ribVectors.addProperty("ADBE Vector Graphic - Fill");
        ribFill.property("ADBE Vector Fill Color").setValue([0, 0, 0]);
        ribFill.property("ADBE Vector Fill Opacity").setValue(78);
        ribGroup.property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue([
          panelWidth * (-0.29 + ribIndex * 0.29),
          0
        ]);
      }

      var column = index % 6;
      var rowOffset = index < 6 ? -0.13 : 0.13;
      var baseX = comp.width * (-0.08 + column * 0.23 + rowOffset);
      var baseY = comp.height * (0.46 + (index % 3 - 1) * 0.12);
      var baseZ = comp.width * (0.92 - Math.floor(index / 3) * 0.31);
      panel.property("ADBE Transform Group").property("ADBE Position").setValue([baseX, baseY, baseZ]);
      panel.property("ADBE Transform Group").property("ADBE Position").expression =
        "var a=2*Math.PI*time/thisComp.duration;var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;value+[Math.sin(a*" + (1 + index % 3) + "+" + index * 0.74 + ")*thisComp.width*" + (0.055 * energy) + ",Math.cos(a*" + (2 + index % 2) + "+" + index * 0.48 + ")*thisComp.height*" + (0.09 * energy) + ",Math.sin(a*2+" + index * 0.62 + ")*thisComp.width*" + ((0.11 + depthSpeed * 0.0012) * energy) + "-f*thisComp.width*.06];";
      panel.property("ADBE Transform Group").property("ADBE Rotate X").expression =
        "var a=2*Math.PI*time/thisComp.duration;Math.sin(a*2+" + index * 0.4 + ")*" + (13 * energy) + ";";
      panel.property("ADBE Transform Group").property("ADBE Rotate Y").expression =
        "var a=2*Math.PI*time/thisComp.duration;Math.cos(a+" + index * 0.78 + ")*" + (32 * energy) + ";";
      panel.property("ADBE Transform Group").property("ADBE Rotate Z").expression =
        "var a=2*Math.PI*time/thisComp.duration;Math.sin(a*3+" + index + ")*" + (4.5 * energy) + ";";
      panel.property("ADBE Transform Group").property("ADBE Scale").expression =
        "var a=2*Math.PI*time/thisComp.duration;var sx=100+Math.sin(a*2+" + index + ")*" + (18 * energy) + ";var sy=100+Math.cos(a*3+" + index * 0.7 + ")*" + (12 * energy) + ";[sx,sy,100];";
      panel.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var a=2*Math.PI*time/thisComp.duration;(" + (36 + index % 4 * 5) + "+Math.sin(a*2+" + index + ")*9)*(l==0?1:l==1?0.74:l==2?1.12:0.62);";
      addGlow(panel, 20 + (index % 3) * 6, 0.55);
    }
  }

  function addNeonShardTunnel(comp, job) {
    var palette = stylePalette(job);
    var energy = intensityEnergy(job);
    var depthSpeed = motionValue(job, "depthSpeed", 90);
    var colors = [palette.primary, palette.secondary, palette.accent, palette.highlight];
    var shardCount = 34;

    for (var index = 0; index < shardCount; index += 1) {
      var shard = comp.layers.addShape();
      shard.name = "NEON_TUNNEL_SHARD_" + pad(index + 1, 2);
      shard.threeDLayer = true;
      shard.motionBlur = true;
      shard.blendingMode = BlendingMode.ADD;
      var root = shard.property("ADBE Root Vectors Group");
      var group = root.addProperty("ADBE Vector Group");
      var vectors = group.property("ADBE Vectors Group");
      var rectangle = vectors.addProperty("ADBE Vector Shape - Rect");
      var length = comp.width * (0.08 + (index % 7) * 0.026);
      var thickness = comp.height * (0.007 + (index % 5) * 0.006);
      rectangle.property("ADBE Vector Rect Size").setValue([length, thickness]);
      rectangle.property("ADBE Vector Rect Roundness").setValue(thickness * 0.42);
      var fill = vectors.addProperty("ADBE Vector Graphic - Fill");
      fill.property("ADBE Vector Fill Color").setValue(colors[index % colors.length]);
      var edge = index % 4;
      var lane = ((index * 37) % 93) / 93;
      var baseX = edge === 0 ? comp.width * (0.02 + lane * 0.24) : edge === 1 ? comp.width * (0.74 + lane * 0.24) : comp.width * (0.08 + lane * 0.84);
      var baseY = edge === 2 ? comp.height * (0.02 + lane * 0.2) : edge === 3 ? comp.height * (0.78 + lane * 0.2) : comp.height * (0.08 + lane * 0.84);
      var phase = index / shardCount;
      shard.property("ADBE Transform Group").property("ADBE Position").setValue([baseX, baseY, comp.width * 1.75]);
      shard.property("ADBE Transform Group").property("ADBE Position").expression =
        "var u=(time/thisComp.duration*" + (0.92 + depthSpeed * 0.009) + "+" + phase + ")%1;var a=2*Math.PI*time/thisComp.duration;var pull=Math.pow(u,1.7);[" + baseX + "+(" + baseX + "-thisComp.width/2)*pull*.35+Math.sin(a*2+" + index + ")*thisComp.width*" + (0.022 * energy) + "," + baseY + "+(" + baseY + "-thisComp.height/2)*pull*.28+Math.cos(a*3+" + index * 0.6 + ")*thisComp.height*" + (0.025 * energy) + ",linear(u,thisComp.width*1.85,-thisComp.width*.34)];";
      shard.property("ADBE Transform Group").property("ADBE Rotate X").expression =
        "var a=2*Math.PI*time/thisComp.duration;Math.sin(a*2+" + index + ")*" + (34 * energy) + ";";
      shard.property("ADBE Transform Group").property("ADBE Rotate Y").expression =
        "var a=2*Math.PI*time/thisComp.duration;Math.cos(a*3+" + index * 0.72 + ")*" + (48 * energy) + ";";
      shard.property("ADBE Transform Group").property("ADBE Rotate Z").setValue(edge < 2 ? 90 : 0);
      shard.property("ADBE Transform Group").property("ADBE Rotate Z").expression =
        "value+Math.sin(2*Math.PI*time/thisComp.duration*3+" + index * 0.9 + ")*" + (13 * energy) + ";";
      shard.property("ADBE Transform Group").property("ADBE Scale").expression =
        "var u=(time/thisComp.duration*" + (0.92 + depthSpeed * 0.009) + "+" + phase + ")%1;value*(.58+u*1.25);";
      shard.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "var u=(time/thisComp.duration*" + (0.92 + depthSpeed * 0.009) + "+" + phase + ")%1;var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');Math.pow(Math.sin(Math.PI*u),.38)*" + (54 + index % 4 * 7) + "*(l==3?0.58:l==2?1.16:1);";
      addGlow(shard, 28 + (index % 4) * 7, 1.2);
    }
  }

  function addPresetEnvironment(comp, job) {
    var style = visualStyle(job);
    if (style === "website") addWebsiteSurfaceField(comp, job);
    if (style === "neon") addNeonShardTunnel(comp, job);
  }

  function addGlobalGlitch(comp, amount, job) {
    var style = visualStyle(job);
    var glitch = glitchAmount(job);
    var count = style === "neon" ? 6 : style === "spline" ? 5 : 4;
    var colors = style === "neon"
      ? [[0.08, 0.86, 1], [1, 0, 0.66], [0.5, 0.04, 1], [0, 0, 0]]
      : [[0.12, 0.78, 1], [0.851, 0, 0.384], [1, 0.875, 0], [0, 0, 0]];
    for (var index = 0; index < count; index += 1) {
      var color = colors[index % colors.length];
      var slice = comp.layers.addSolid(
        color,
        "GLOBAL_GLITCH_SLICE_" + pad(index + 1, 2),
        Math.max(2, Math.round(comp.width * (0.42 + (index % 3) * 0.22))),
        Math.max(2, Math.round(comp.height * (0.018 + (index % 3) * 0.016))),
        1,
        comp.duration
      );
      slice.motionBlur = true;
      if (color[0] + color[1] + color[2] > 0) slice.blendingMode = BlendingMode.ADD;
      slice.property("ADBE Transform Group").property("ADBE Position").expression =
        "var c=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider');var k=c.numKeys?Math.floor((c.nearestKey(time).index-1)/3):0;seedRandom(k*97+" + (400 + index * 17) + ",true);[random(-thisComp.width*.08,thisComp.width*1.08),random(thisComp.height*.08,thisComp.height*.92)];";
      slice.property("ADBE Transform Group").property("ADBE Scale").expression =
        "var c=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider');var f=c/100;var k=c.numKeys?Math.floor((c.nearestKey(time).index-1)/3):0;seedRandom(k*101+" + (450 + index * 19) + ",true);[100+f*random(25," + (90 + amount) + "),100+f*random(-30,48)];";
      slice.property("ADBE Transform Group").property("ADBE Rotate Z").expression =
        "var c=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider');var f=c/100;var k=c.numKeys?Math.floor((c.nearestKey(time).index-1)/3):0;seedRandom(k*103+" + (470 + index * 23) + ",true);random(-4,4)*f;";
      slice.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;f*" + (color[0] + color[1] + color[2] === 0 ? 58 : 22 + glitch * 0.28) + ";";
    }
  }

  function addSplineSweeps(comp, amount, job) {
    if (amount <= 0) return [];
    var energy = intensityEnergy(job);
    var style = visualStyle(job);
    var palette = stylePalette(job);
    var count = style === "spline"
      ? Math.round(clamp(6 + amount / 20, 7, 10))
      : Math.round(clamp(2 + amount / 30, 2, style === "neon" ? 6 : 5));
    var colors = [palette.primary, palette.accent, palette.secondary, palette.highlight];
    var sweeps = [];
    for (var index = 0; index < count; index += 1) {
      var sweep = comp.layers.addShape();
      sweep.name = "ENERGY_TRAIL_" + pad(index + 1, 2);
      sweep.threeDLayer = true;
      sweep.motionBlur = true;
      sweep.blendingMode = BlendingMode.ADD;

      var root = sweep.property("ADBE Root Vectors Group");
      var group = root.addProperty("ADBE Vector Group");
      group.name = "CURVED_PATH";
      var vectors = group.property("ADBE Vectors Group");
      var pathProperty = vectors.addProperty("ADBE Vector Shape - Group");
      var verticalSlot = (index + 0.5) / count;
      var amplitude = comp.height * (style === "spline" ? 0.24 : 0.11) * (index % 2 === 0 ? 1 : -1);
      var pathShape = new Shape();
      pathShape.vertices = [
        [-comp.width * 0.72, comp.height * (verticalSlot - 0.5)],
        [-comp.width * 0.28, comp.height * (verticalSlot - 0.5) + amplitude],
        [comp.width * 0.08, comp.height * (verticalSlot - 0.5) - amplitude * 0.8],
        [comp.width * 0.42, comp.height * (verticalSlot - 0.5) + amplitude * 0.55],
        [comp.width * 0.72, comp.height * (verticalSlot - 0.5)]
      ];
      pathShape.inTangents = [
        [0, 0],
        [-comp.width * 0.14, -amplitude * 0.32],
        [-comp.width * 0.13, amplitude * 0.34],
        [-comp.width * 0.12, -amplitude * 0.28],
        [-comp.width * 0.13, 0]
      ];
      pathShape.outTangents = [
        [comp.width * 0.16, 0],
        [comp.width * 0.14, amplitude * 0.32],
        [comp.width * 0.13, -amplitude * 0.34],
        [comp.width * 0.12, amplitude * 0.28],
        [0, 0]
      ];
      pathShape.closed = false;
      pathProperty.property("ADBE Vector Shape").setValue(pathShape);

      var haloStroke = vectors.addProperty("ADBE Vector Graphic - Stroke");
      haloStroke.property("ADBE Vector Stroke Color").setValue(colors[index % colors.length]);
      haloStroke.property("ADBE Vector Stroke Width").setValue(comp.height * (style === "spline" ? 0.058 + (index % 3) * 0.014 : 0.022 + (index % 3) * 0.006));
      haloStroke.property("ADBE Vector Stroke Opacity").setValue(style === "spline" ? 15 : style === "neon" ? 13 : 9);
      var coreStroke = vectors.addProperty("ADBE Vector Graphic - Stroke");
      coreStroke.property("ADBE Vector Stroke Color").setValue(colors[index % colors.length]);
      coreStroke.property("ADBE Vector Stroke Width").setValue(comp.height * (style === "spline" ? 0.012 + (index % 3) * 0.004 : 0.0035 + (index % 3) * 0.0015));
      coreStroke.property("ADBE Vector Stroke Opacity").setValue(clamp(46 + amount * 0.34 + energy * 6 - index * 2, 42, 88));
      if (style === "spline") {
        var highlightStroke = vectors.addProperty("ADBE Vector Graphic - Stroke");
        highlightStroke.property("ADBE Vector Stroke Color").setValue(palette.highlight);
        highlightStroke.property("ADBE Vector Stroke Width").setValue(comp.height * (0.0026 + (index % 2) * 0.0014));
        highlightStroke.property("ADBE Vector Stroke Opacity").setValue(72);
      }

      var trim = root.addProperty("ADBE Vector Filter - Trim");
      trim.property("ADBE Vector Trim Start").setValue(0);
      trim.property("ADBE Vector Trim End").setValue(style === "spline" ? 24 + (index % 3) * 5 : 18 + (index % 3) * 4);
      trim.property("ADBE Vector Trim Offset").expression =
        "var speed=" + (1.05 + (index % 3) * 0.22 + energy * 0.08) + ";(time/thisComp.duration*360*speed+" + index * (360 / count) + ")%360;";

      sweep.property("ADBE Transform Group").property("ADBE Position").setValue([
        comp.width / 2,
        comp.height / 2,
        comp.width * (style === "spline" ? -0.28 + (index % 6) * 0.16 : -0.12 + (index % 4) * 0.1)
      ]);
      sweep.property("ADBE Transform Group").property("ADBE Position").expression =
        "var a=2*Math.PI*time/thisComp.duration;value+[" + (style === "spline" ? "Math.sin(a+" + index * 0.83 + ")*thisComp.width*" + (0.075 * energy) : "0") + ",Math.sin(a+" + index * 1.4 + ")*thisComp.height*" + ((style === "spline" ? 0.052 : 0.018) * energy) + ",Math.sin(2*a+" + index + ")*thisComp.width*" + ((style === "spline" ? 0.12 : 0.035) * energy) + "];";
      sweep.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var pulse=.76+.24*Math.sin(4*Math.PI*time/thisComp.duration+" + index + ");value*pulse*(l==1?1.15:l==2?1:" + (style === "spline" ? "0.84" : "0.72") + ");";
      addGlow(sweep, style === "spline" ? 54 + amount * 0.38 : 26 + amount * 0.32, style === "neon" ? 1.15 : style === "spline" ? 1.05 : 0.72);
      sweeps.push(sweep);
    }
    return sweeps;
  }

  function addDepthParticles(comp, job) {
    var energy = intensityEnergy(job);
    var style = visualStyle(job);
    var palette = stylePalette(job);
    var particles = motionValue(job, "particleAmount", 68);
    var depthSpeed = motionValue(job, "depthSpeed", 78);
    var amount = style === "website"
      ? Math.round(clamp(6 + particles / 8, 9, 15))
      : style === "neon"
        ? Math.round(clamp(14 + particles / 5, 20, 32))
        : Math.round(clamp(9 + particles / 7, 12, 20));
    var colors = [palette.primary, palette.highlight, palette.accent, palette.secondary];
    for (var index = 0; index < amount; index += 1) {
      var layer = comp.layers.addShape();
      layer.name = "DEPTH_PARTICLE_" + pad(index + 1, 2);
      layer.threeDLayer = true;
      layer.motionBlur = true;
      layer.blendingMode = BlendingMode.ADD;
      var root = layer.property("ADBE Root Vectors Group");
      var group = root.addProperty("ADBE Vector Group");
      var vectors = group.property("ADBE Vectors Group");
      var ellipse = vectors.addProperty(index % 4 === 0 ? "ADBE Vector Shape - Rect" : "ADBE Vector Shape - Ellipse");
      var diameter = comp.height * (0.004 + (index % 5) * 0.0022);
      if (index % 4 === 0) {
        ellipse.property("ADBE Vector Rect Size").setValue([diameter * 3.4, diameter * 0.7]);
      } else {
        ellipse.property("ADBE Vector Ellipse Size").setValue([diameter, diameter]);
      }
      var fill = vectors.addProperty("ADBE Vector Graphic - Fill");
      fill.property("ADBE Vector Fill Color").setValue(colors[index % colors.length]);
      var x = comp.width * (0.06 + ((index * 37) % 89) / 100);
      var y = comp.height * (0.07 + ((index * 53) % 83) / 100);
      if (style === "neon" && x > comp.width * 0.3 && x < comp.width * 0.7 && y > comp.height * 0.27 && y < comp.height * 0.73) {
        x = index % 2 === 0 ? comp.width * 0.18 : comp.width * 0.82;
      }
      var phase = index / amount;
      layer.property("ADBE Transform Group").property("ADBE Position").setValue([x, y, comp.width * 1.5]);
      layer.property("ADBE Transform Group").property("ADBE Position").expression =
        "var u=(time/thisComp.duration*" + (0.62 + depthSpeed * 0.007) + "+" + phase + ")%1;var a=2*Math.PI*time/thisComp.duration;[" + x + "+Math.sin(a+" + index * 0.71 + ")*thisComp.width*" + (0.045 * energy) + "," + y + "+Math.cos(2*a+" + index * 0.43 + ")*thisComp.height*" + (0.055 * energy) + ",linear(u,thisComp.width*1.7,-thisComp.width*.28)];";
      layer.property("ADBE Transform Group").property("ADBE Scale").expression =
        "var a=2*Math.PI*time/thisComp.duration;value*(1+Math.sin(3*a+" + index + ")*" + (0.16 * energy) + ");";
      layer.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "var u=(time/thisComp.duration*" + (0.62 + depthSpeed * 0.007) + "+" + phase + ")%1;var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');Math.pow(Math.sin(Math.PI*u),.45)*" + clamp(28 + particles * 0.36, 30, 64) + "*(l==3?0.42:1);";
      addGlow(layer, 18 + (index % 4) * 4, style === "neon" ? 1 : 0.62);
    }
  }

  function addCamera(comp, job) {
    var strength = motionValue(job, "cameraStrength", 72);
    var energy = intensityEnergy(job);
    var style = visualStyle(job);
    var xMultiplier = style === "spline" ? 1.8 : style === "website" ? 1.1 : 0.82;
    var yMultiplier = style === "spline" ? 1.35 : style === "website" ? 1 : 0.82;
    var zMultiplier = style === "neon" ? 2.25 : style === "website" ? 1.15 : 1.2;
    var xAmount = comp.width * (0.018 + strength * 0.00075) * energy * xMultiplier;
    var yAmount = comp.height * (0.014 + strength * 0.00055) * energy * yMultiplier;
    var zAmount = comp.width * (0.03 + strength * 0.00018) * energy * zMultiplier;
    var cameraDistance = comp.width * 0.94;
    var camera = comp.layers.addCamera("CAMERA_RIG", [comp.width / 2, comp.height / 2]);
    var transform = camera.property("ADBE Transform Group");
    transform.property("ADBE Position").setValue([comp.width / 2, comp.height / 2, -cameraDistance]);
    // Keep AE's perspective scale deterministic at every canvas size. The
    // default camera zoom is tied to AE's film-back preset, so matching zoom
    // to the base camera distance makes a 50%-wide 3D layer read as 50% of
    // frame before its intentional depth animation is applied.
    camera.property("ADBE Camera Options Group").property("ADBE Camera Zoom").setValue(cameraDistance);
    var pointOfInterest = transform.property("ADBE Anchor Point") || transform.property("Point of Interest") || transform.property(1);
    pointOfInterest.setValue([comp.width / 2, comp.height / 2, 0]);
    transform.property("ADBE Position").expression =
      "var a=2*Math.PI*time/thisComp.duration;value+[Math.sin(a)*" + xAmount + ",Math.cos(2*a)*" + yAmount + ",Math.sin(3*a)*" + zAmount + "];";
    pointOfInterest.expression =
      "var a=2*Math.PI*time/thisComp.duration;value+[Math.sin(2*a)*" + xAmount * 0.35 + ",Math.cos(3*a)*" + yAmount * 0.35 + ",Math.sin(a)*" + zAmount * 0.12 + "];";
    return camera;
  }

  function addGlitchTint(layer, color) {
    try {
      var tint = layer.property("ADBE Effect Parade").addProperty("ADBE Tint");
      tint.property(1).setValue([color[0] * 0.08, color[1] * 0.08, color[2] * 0.08]);
      tint.property(2).setValue(color);
      tint.property(3).setValue(100);
    } catch (ignoreTint) {}
  }

  function addLogoGlitchEchoes(comp, layer, job) {
    var glitch = glitchAmount(job);
    if (glitch <= 0) return;
    var colors = [[0.12, 0.78, 1], [0.851, 0, 0.384]];
    for (var echoIndex = 0; echoIndex < 2; echoIndex += 1) {
      var echo = layer.duplicate();
      echo.name = layer.name + "_GLITCH_" + (echoIndex === 0 ? "CYAN" : "PINK");
      echo.blendingMode = BlendingMode.ADD;
      addGlitchTint(echo, colors[echoIndex]);
      echo.property("ADBE Transform Group").property("ADBE Position").expression =
        "var p=thisComp.layer('" + layer.name + "').transform.position;var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;seedRandom(Math.floor(time*thisComp.frameRate)+" + (80 + echoIndex) + ",true);var g=thisComp.width*" + (0.0015 + glitch * 0.00011) + "*f;p+[random(-g,g),random(-g,g),random(-g*2,g*2)];";
      echo.property("ADBE Transform Group").property("ADBE Scale").expression =
        "var s=thisComp.layer('" + layer.name + "').transform.scale;var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;s*(1+f*" + (0.018 + echoIndex * 0.012) + ");";
      echo.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')*" + (0.12 + glitch * 0.0022) + ";";
      echo.moveAfter(layer);
    }
  }

  function addLogo(comp, footage, job, position, targetWidth, name) {
    if (!footage) return null;
    var energy = intensityEnergy(job);
    var style = visualStyle(job);
    var glitch = glitchAmount(job);
    var depthSpeed = motionValue(job, "depthSpeed", 78);
    var layer = comp.layers.add(footage);
    layer.name = name;
    layer.threeDLayer = true;
    try { layer.autoOrient = AutoOrientType.CAMERA_OR_POINT_OF_INTEREST; } catch (ignoreMainAutoOrient) {}
    layer.motionBlur = true;
    fitLogoLayer(layer, comp, targetWidth);
    layer.property("ADBE Transform Group").property("ADBE Position").setValue([position[0], position[1], 0]);
    layer.property("ADBE Transform Group").property("ADBE Position").expression =
      "var a=2*Math.PI*time/thisComp.duration;var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;seedRandom(Math.floor(time*thisComp.frameRate)+31,true);var g=f*thisComp.width*" + (glitch * 0.00008) + ";value+[Math.sin(a)*thisComp.width*" + (0.025 * energy) + "+random(-g,g),Math.cos(2*a)*thisComp.height*" + (0.035 * energy) + "+random(-g,g),Math.sin(3*a)*thisComp.width*" + ((0.025 + depthSpeed * 0.00055) * energy) + "+(l==2?-thisComp.width*.08:0)];";
    layer.property("ADBE Transform Group").property("ADBE Scale").expression =
      "var a=2*Math.PI*time/thisComp.duration;var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var cue=l==0?1:l==1?0.86:l==2?1.18:0.72;value*cue*(1+Math.sin(2*a)*" + (0.09 * energy) + ");";
    layer.property("ADBE Transform Group").property("ADBE Opacity").expression =
      "var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');l==0?100:l==1?25:l==2?90:10;";

    var copies = logoInstanceCount(job);
    var startXs = [0.14, 0.82, 0.18, 0.78, 0.5];
    var startYs = [0.2, 0.18, 0.78, 0.74, 0.34];
    for (var copyIndex = 1; copyIndex < copies; copyIndex += 1) {
      var copy = comp.layers.add(footage);
      copy.name = name + "_COPY_" + pad(copyIndex, 2);
      copy.threeDLayer = true;
      try { copy.autoOrient = AutoOrientType.CAMERA_OR_POINT_OF_INTEREST; } catch (ignoreCopyAutoOrient) {}
      copy.motionBlur = true;
      fitLogoLayer(copy, comp, targetWidth * (0.34 + (copyIndex % 3) * 0.1));
      var startX = startXs[(copyIndex - 1) % startXs.length];
      var startY = startYs[(copyIndex - 1) % startYs.length];
      copy.property("ADBE Transform Group").property("ADBE Position").setValue([
        comp.width * startX,
        comp.height * startY,
        -comp.width * (0.045 + copyIndex * 0.018)
      ]);
      var phase = copyIndex * 1.73;
      var xRate = 1 + copyIndex % 3;
      var yRate = 2 + (copyIndex + 1) % 3;
      if (style === "spline") {
        copy.property("ADBE Transform Group").property("ADBE Position").expression =
          "var u=(time/thisComp.duration+" + copyIndex / Math.max(1, copies - 1) + ")%1;var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;seedRandom(Math.floor(time*thisComp.frameRate)+" + (120 + copyIndex) + ",true);var g=f*thisComp.width*" + (glitch * 0.00006) + ";[thisComp.width*(-.2+1.4*u)+random(-g,g),thisComp.height*" + startY + "+Math.sin(2*Math.PI*u*" + yRate + "+" + phase + ")*thisComp.height*" + (0.08 + copyIndex * 0.018) + "+random(-g,g),value[2]+Math.sin(2*Math.PI*u*2+" + phase + ")*thisComp.width*" + ((0.05 + depthSpeed * 0.00055) * energy) + "];";
      } else {
        copy.property("ADBE Transform Group").property("ADBE Position").expression =
          "var a=2*Math.PI*time/thisComp.duration+" + phase + ";var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;seedRandom(Math.floor(time*thisComp.frameRate)+" + (120 + copyIndex) + ",true);var g=f*thisComp.width*" + (glitch * 0.00006) + ";value+[Math.sin(a*" + xRate + ")*thisComp.width*" + (0.16 + copyIndex * 0.018 + (style === "neon" ? 0.05 : 0)) + "+random(-g,g),Math.cos(a*" + yRate + ")*thisComp.height*" + (0.18 + copyIndex * 0.025 + (style === "neon" ? 0.05 : 0)) + "+random(-g,g),Math.sin(a*3)*thisComp.width*" + ((0.06 + depthSpeed * 0.0007) * energy) + "];";
      }
      copy.property("ADBE Transform Group").property("ADBE Scale").expression =
        "var a=2*Math.PI*time/thisComp.duration+" + phase + ";value*(1+Math.sin(a*2)*" + (0.24 * energy) + ");";
      copy.property("ADBE Transform Group").property("ADBE Opacity").setValue(clamp(38 - copyIndex * 4 + energy * 4, 20, 48));
      copy.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;var slot=Math.floor(time/(thisComp.duration/" + Math.max(1, (copies - 1) * 2) + "))%" + Math.max(1, copies - 1) + ";var on=slot==" + (copyIndex - 1) + "?1:0;var base=" + clamp(38 - copyIndex * 4 + energy * 4, 20, 48) + ";base*on*(l==1?1:0)+f*5;";
      copy.moveAfter(layer);
    }
    addLogoGlitchEchoes(comp, layer, job);
    return layer;
  }

  function makeMasterBase(name, job, background, footage, sharedFolder, flashEvents) {
    var comp = app.project.items.addComp(name, job.canvas.width, job.canvas.height, 1, job.canvas.durationSeconds, job.canvas.fps);
    comp.parentFolder = sharedFolder;
    comp.motionBlur = true;
    comp.shutterAngle = 180;
    var energy = intensityEnergy(job);
    var matte = comp.layers.addSolid([0, 0, 0], "MASTER_BLACK_MATTE", comp.width, comp.height, 1, comp.duration);
    addFlashClock(comp, flashEvents, job.canvas.fps);
    addLookClock(comp, job.canvas.fps);
    var backgroundLayer = comp.layers.add(background);
    backgroundLayer.name = "BG_HALFTONE";
    backgroundLayer.threeDLayer = true;
    backgroundLayer.motionBlur = true;
    backgroundLayer.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width / 2, comp.height / 2, comp.width * 0.25]);
    backgroundLayer.property("ADBE Transform Group").property("ADBE Scale").setValue([145, 145, 145]);
    backgroundLayer.property("ADBE Transform Group").property("ADBE Scale").expression =
      "var a=2*Math.PI*time/thisComp.duration;value*(1+Math.sin(a)*" + (0.045 * energy) + ");";
    backgroundLayer.property("ADBE Transform Group").property("ADBE Rotate X").expression =
      "var a=2*Math.PI*time/thisComp.duration;Math.sin(2*a)*" + (2.8 * energy) + ";";
    backgroundLayer.property("ADBE Transform Group").property("ADBE Rotate Y").expression =
      "var a=2*Math.PI*time/thisComp.duration;Math.cos(a)*" + (4.2 * energy) + ";";
    backgroundLayer.property("ADBE Transform Group").property("ADBE Rotate Z").expression =
      "var a=2*Math.PI*time/thisComp.duration;Math.sin(3*a)*" + (1.8 * energy) + ";";
    addDimensionalStage(comp, job);
    addPresetEnvironment(comp, job);
    addDepthParticles(comp, job);
    addSplineSweeps(comp, job.motion.lightSweepAmount, job);
    addCamera(comp, job);
    addGlobalGlitch(comp, job.motion.lightSweepAmount, job);
    matte.moveToEnd();
    return comp;
  }

  function styleArtistText(layer, comp, layout, animation, job) {
    var textProperty = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var document = textProperty.value;
    var style = visualStyle(job);
    var baseSize = comp.height * (layout === "center" ? 0.22 : 0.15);
    document.font = "Panton-BlackCaps";
    document.fontSize = baseSize;
    document.applyFill = true;
    document.fillColor = [1, 1, 1];
    document.applyStroke = false;
    document.strokeWidth = 0;
    document.justification = ParagraphJustification.CENTER_JUSTIFY;
    document.tracking = 6;
    textProperty.setValue(document);

    try {
      var glow = layer.property("ADBE Effect Parade").addProperty("ADBE Glo2");
      glow.property(3).setValue(style === "neon" ? 42 : style === "spline" ? 26 : 16);
      glow.property(6).setValue(style === "neon" ? 1 : 0.55);
    } catch (ignoreGlow) {}

    var opacity = layer.property("ADBE Transform Group").property("ADBE Opacity");
    var scale = layer.property("ADBE Transform Group").property("ADBE Scale");
    var energy = intensityEnergy(job);
    if (animation === "steady_glow") {
      opacity.expression = "var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');(90+Math.sin(4*Math.PI*time/thisComp.duration)*8)*(l==3?0.82:1);";
      scale.expression = "var a=2*Math.PI*time/thisComp.duration;var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var cue=l==0?1:l==1?0.96:l==2?1.055:0.92;value*cue*(1+Math.sin(2*a)*" + (0.025 * energy) + ");";
    } else if (animation === "punch_flash") {
      opacity.expression = "var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;seedRandom(Math.floor(time*thisComp.frameRate)+510,true);(78+Math.sin(4*Math.PI*time/thisComp.duration)*6+f*random(8,18))*(l==3?0.78:1);";
      scale.expression = "var a=2*Math.PI*time/thisComp.duration;var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;seedRandom(Math.floor(time*thisComp.frameRate)+511,true);var cue=l==0?1:l==1?0.95:l==2?1.08:0.91;var s=cue+Math.sin(2*a)*0.02+f*random(-.035," + (0.08 * energy) + ");[value[0]*s,value[1]*(cue+f*random(-.025,.035))];";
    } else {
      opacity.expression = "var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;seedRandom(Math.floor(time*thisComp.frameRate)+520,true);(90+Math.sin(4*Math.PI*time/thisComp.duration)*5-f*random(0,11))*(l==3?0.8:1);";
      scale.expression = "var a=2*Math.PI*time/thisComp.duration;var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;seedRandom(Math.floor(time*thisComp.frameRate)+521,true);var cue=l==0?1:l==1?0.965:l==2?1.06:0.92;var sx=cue+Math.sin(2*a)*0.018+f*random(-.04,.065);var sy=cue+f*random(-.025,.035);[value[0]*sx,value[1]*sy];";
    }
  }

  function addArtistFrame(comp, layout, job) {
    var palette = stylePalette(job);
    var style = visualStyle(job);
    var frame = comp.layers.addShape();
    frame.name = "ARTIST_STAGE_FRAME";
    frame.blendingMode = BlendingMode.ADD;
    var root = frame.property("ADBE Root Vectors Group");
    var yPositions = layout === "center"
      ? [-comp.height * 0.155, comp.height * 0.155]
      : [-comp.height * 0.415, -comp.height * 0.205];
    for (var lineIndex = 0; lineIndex < 2; lineIndex += 1) {
      var group = root.addProperty("ADBE Vector Group");
      group.name = lineIndex === 0 ? "UPPER_RAIL" : "LOWER_RAIL";
      var vectors = group.property("ADBE Vectors Group");
      var path = vectors.addProperty("ADBE Vector Shape - Group");
      var shape = new Shape();
      shape.vertices = [[-comp.width * 0.44, yPositions[lineIndex]], [comp.width * 0.44, yPositions[lineIndex]]];
      shape.inTangents = [[0,0],[0,0]];
      shape.outTangents = [[0,0],[0,0]];
      shape.closed = false;
      path.property("ADBE Vector Shape").setValue(shape);
      var halo = vectors.addProperty("ADBE Vector Graphic - Stroke");
      halo.property("ADBE Vector Stroke Color").setValue(lineIndex === 0 ? palette.primary : palette.accent);
      halo.property("ADBE Vector Stroke Width").setValue(comp.height * 0.008);
      halo.property("ADBE Vector Stroke Opacity").setValue(style === "neon" ? 12 : 7);
      var core = vectors.addProperty("ADBE Vector Graphic - Stroke");
      core.property("ADBE Vector Stroke Color").setValue(lineIndex === 0 ? palette.primary : palette.accent);
      core.property("ADBE Vector Stroke Width").setValue(comp.height * 0.0018);
      core.property("ADBE Vector Stroke Opacity").setValue(style === "neon" ? 72 : 48);
    }
    var trim = root.addProperty("ADBE Vector Filter - Trim");
    trim.property("ADBE Vector Trim Start").setValue(0);
    trim.property("ADBE Vector Trim End").setValue(style === "neon" ? 42 : 34);
    trim.property("ADBE Vector Trim Offset").expression =
      "(time/thisComp.duration*360*1.6)%360;";
    frame.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width / 2, comp.height / 2]);
    frame.property("ADBE Transform Group").property("ADBE Opacity").expression =
      "var l=thisComp.layer('LOOK_CLOCK').effect('Look')('Slider');var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;(l==3?32:l==2?88:62)+f*10;";
    addGlow(frame, style === "neon" ? 34 : 20, style === "neon" ? 1 : 0.55);
    return frame;
  }

  function setArtistGlitchBandMask(layer, rect, bandIndex, bandCount) {
    var width = layer.containingComp.width;
    var maskParade = layer.property("ADBE Mask Parade");
    var mask = maskParade.numProperties > 0 ? maskParade.property(1) : maskParade.addProperty("ADBE Mask Atom");
    mask.name = "HORIZONTAL_GLITCH_BAND";
    var bandHeight = rect.height * (0.16 + (bandIndex % 2) * 0.055);
    var top = rect.top + rect.height * (0.06 + bandIndex * (0.88 / bandCount));
    var left = rect.left - width * 0.03;
    var right = rect.left + rect.width + width * 0.03;
    var shape = new Shape();
    shape.vertices = [[left, top], [right, top], [right, top + bandHeight], [left, top + bandHeight]];
    shape.inTangents = [[0,0],[0,0],[0,0],[0,0]];
    shape.outTangents = [[0,0],[0,0],[0,0],[0,0]];
    shape.closed = true;
    mask.property("ADBE Mask Shape").setValue(shape);
  }

  function addArtistGlitchEchoes(comp, layer, job) {
    var glitch = glitchAmount(job);
    if (glitch <= 0) return;
    var style = visualStyle(job);
    var boost = style === "neon" ? 1.5 : style === "spline" ? 1.15 : 1;
    var colors = style === "neon" ? [[0.08, 0.86, 1], [1, 0, 0.66]] : [[0.12, 0.78, 1], [0.851, 0, 0.384]];
    var bandCount = 4;
    var rect = layer.sourceRectAtTime(0, false);
    for (var echoIndex = 0; echoIndex < bandCount; echoIndex += 1) {
      var echo = layer.duplicate();
      echo.name = "ARTIST_GLITCH_BAND_" + pad(echoIndex + 1, 2);
      echo.blendingMode = BlendingMode.ADD;
      echo.property("ADBE Text Properties").property("ADBE Text Document").expression =
        "var d=thisComp.layer('ARTIST_NAME').text.sourceText;d.applyFill=true;d.fillColor=[" + colors[echoIndex % colors.length].join(",") + "];d.applyStroke=false;d.strokeWidth=0;d;";
      echo.property("ADBE Transform Group").property("ADBE Anchor Point").expression =
        "thisComp.layer('ARTIST_NAME').transform.anchorPoint;";
      echo.property("ADBE Transform Group").property("ADBE Position").expression =
        "var p=thisComp.layer('ARTIST_NAME').transform.position;var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;seedRandom(Math.floor(time*thisComp.frameRate)+" + (210 + echoIndex) + ",true);var g=thisComp.width*" + ((0.0022 + glitch * 0.00018) * boost) + "*f;p+[random(-g,g),random(-g*.14,g*.14)];";
      echo.property("ADBE Transform Group").property("ADBE Scale").expression =
        "var s=thisComp.layer('ARTIST_NAME').transform.scale;var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;[s[0]*(1+f*" + (0.035 + echoIndex * 0.012) + "),s[1]*(1+f*" + (0.004 + echoIndex * 0.002) + ")];";
      echo.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')*" + ((0.16 + glitch * 0.0028) * boost) + ";";
      setArtistGlitchBandMask(echo, rect, echoIndex, bandCount);
      echo.moveAfter(layer);
    }
  }

  function fitArtistText(layer, comp, name, layout) {
    var textProperty = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var document = textProperty.value;
    var baseSize = comp.height * (layout === "center" ? 0.22 : 0.15);
    var maxWidth = comp.width * (layout === "center" ? 0.86 : 0.86);
    var display = String(name).toUpperCase();
    document.text = display;
    document.fontSize = baseSize;
    textProperty.setValue(document);

    var rect = layer.sourceRectAtTime(0, false);
    while (rect.width > maxWidth && document.fontSize > baseSize * 0.68) {
      document.fontSize -= Math.max(2, comp.height * 0.003);
      textProperty.setValue(document);
      rect = layer.sourceRectAtTime(0, false);
    }

    if (rect.width > maxWidth) {
      document.tracking = -12;
      textProperty.setValue(document);
      rect = layer.sourceRectAtTime(0, false);
    }

    if (rect.width > maxWidth && display.indexOf(" ") !== -1) {
      document.text = splitArtistName(display);
      document.fontSize = baseSize;
      textProperty.setValue(document);
      rect = layer.sourceRectAtTime(0, false);
      while ((rect.width > maxWidth || rect.height > comp.height * (layout === "center" ? 0.3 : 0.23)) && document.fontSize > comp.height * 0.045) {
        document.fontSize -= Math.max(2, comp.height * 0.003);
        textProperty.setValue(document);
        rect = layer.sourceRectAtTime(0, false);
      }
    }

    if (rect.width > maxWidth || document.fontSize < comp.height * 0.045) {
      throw new Error("Artist name cannot fit safely: " + name);
    }
    layer.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    ]);
    layer.property("ADBE Transform Group").property("ADBE Position").setValue([
      comp.width / 2,
      layout === "center" ? comp.height / 2 : comp.height * 0.19
    ]);
  }

  function addArtistText(comp, name, layout, animation, job) {
    var layer = comp.layers.addText(name);
    layer.name = "ARTIST_NAME";
    styleArtistText(layer, comp, layout, animation, job);
    fitArtistText(layer, comp, name, layout);
    if (animation !== "steady_glow") {
      var glitch = glitchAmount(job);
      layer.property("ADBE Transform Group").property("ADBE Position").expression =
        "var f=thisComp.layer('FLASH_CLOCK').effect('Flash')('Slider')/100;seedRandom(Math.floor(time*thisComp.frameRate)+530,true);var g=thisComp.width*" + (0.001 + glitch * 0.0001) + "*f;value+[random(-g,g),random(-g*.3,g*.3)];";
    }
    addArtistGlitchEchoes(comp, layer, job);
    return layer;
  }

  function makeLogoMaster(job, background, footage, templatesFolder, flashEvents) {
    var comp = makeMasterBase("MASTER_LOGO", job, background, footage, templatesFolder, flashEvents);
    addLogo(comp, footage, job, [comp.width / 2, comp.height / 2], job.motion.logoScale, "UPFORIT_LOGO_MAIN");
    return comp;
  }

  function makeArtistTemplate(job, background, footage, templatesFolder, flashEvents, layout) {
    var name = layout === "center" ? "MASTER_ARTIST_CENTER" : "MASTER_ARTIST_TOP_THIRD";
    var comp = makeMasterBase(name, job, background, footage, templatesFolder, flashEvents);
    if (layout === "center") {
      addLogo(comp, footage, job, [comp.width / 2, comp.height * 0.84], 12, "UPFORIT_LOGO_BUG");
    } else {
      addLogo(comp, footage, job, [comp.width / 2, comp.height * 0.66], Math.min(44, job.motion.logoScale), "UPFORIT_LOGO_MAIN");
    }
    addArtistFrame(comp, layout, job);
    addArtistText(comp, "ARTIST NAME", layout, job.content.textAnimation, job);
    return comp;
  }

  function duplicateArtistComp(template, name, slug, index, layout, artistsFolder) {
    var comp = template.duplicate();
    comp.name = pad(index + 1, 2) + "_" + slug + "_" + (layout === "center" ? "CENTER" : "TOP_THIRD");
    comp.parentFolder = artistsFolder;
    var layer = comp.layer("ARTIST_NAME");
    fitArtistText(layer, comp, name, layout);
    var rect = layer.sourceRectAtTime(0, false);
    var bandIndex = 0;
    for (var layerIndex = 1; layerIndex <= comp.numLayers; layerIndex += 1) {
      var candidate = comp.layer(layerIndex);
      if (candidate.name.indexOf("ARTIST_GLITCH_BAND_") === 0) {
        setArtistGlitchBandMask(candidate, rect, bandIndex, 4);
        bandIndex += 1;
      }
    }
    return comp;
  }

  function makePreviewWrapper(comp, previewsFolder) {
    var wrapper = app.project.items.addComp("PREVIEW_" + comp.name, 960, 540, 1, comp.duration, comp.frameRate);
    wrapper.parentFolder = previewsFolder;
    var black = wrapper.layers.addSolid([0, 0, 0], "PREVIEW_MATTE", 960, 540, 1, comp.duration);
    var layer = wrapper.layers.add(comp);
    var scale = Math.min(960 / comp.width, 540 / comp.height) * 100;
    layer.property("ADBE Transform Group").property("ADBE Scale").setValue([scale, scale]);
    layer.property("ADBE Transform Group").property("ADBE Position").setValue([480, 270]);
    black.moveToEnd();
    return wrapper;
  }

  function queueComp(comp, outputPath, label, metadata, renderItems, outputTemplates) {
    var renderItem = app.project.renderQueue.items.add(comp);
    var outputModule = renderItem.outputModule(1);
    var templates = outputModule.templates;
    if (outputTemplates.length === 0) {
      for (var index = 0; index < templates.length; index += 1) outputTemplates.push(templates[index]);
    }
    var losslessFound = false;
    for (var templateIndex = 0; templateIndex < templates.length; templateIndex += 1) {
      if (templates[templateIndex] === "Lossless") losslessFound = true;
    }
    if (!losslessFound) throw new Error("Required output-module template 'Lossless' is not installed.");
    outputModule.applyTemplate("Lossless");
    outputModule = renderItem.outputModule(1);
    outputModule.file = new File(outputPath);
    renderItems.push({
      sourcePath: outputPath,
      label: label,
      artist: metadata.artist,
      layout: metadata.layout,
      preview: metadata.preview
    });
  }

  try {
    var inputPath = typeof UPFORIT_JOB_SPEC !== "undefined" && UPFORIT_JOB_SPEC
      ? UPFORIT_JOB_SPEC
      : $.getenv("UPFORIT_JOB_SPEC");
    if (!inputPath) throw new Error("UPFORIT_JOB_SPEC was not provided.");
    var input = parseJson(readText(inputPath));
    resultPath = input.resultPath;
    var job = input.job;

    app.beginUndoGroup("Build UPFORIT Visuals");
    app.newProject();
    projectWasCreated = true;
    app.project.bitsPerChannel = 16;
    try { app.project.workingSpace = "Rec.709 Gamma 2.4"; } catch (ignoreWorkingSpace) {}

    var rootFolder = addFolder("UPFORIT_VISUALS");
    var controlsFolder = addFolder("00_CONTROLS", rootFolder);
    var assetsFolder = addFolder("ASSETS", rootFolder);
    var sharedFolder = addFolder("SHARED", rootFolder);
    var templatesFolder = addFolder("TEMPLATES", rootFolder);
    var artistsFolder = addFolder("ARTISTS", rootFolder);
    var previewsFolder = addFolder("PREVIEWS", rootFolder);

    makeControlsComp(job, controlsFolder);
    makeSharedUtilityComp("BG_RAYS", job, sharedFolder);
    makeSharedUtilityComp("DEPTH_CARDS", job, sharedFolder);
    makeSharedUtilityComp("LIGHT_SWEEPS", job, sharedFolder);
    makeSharedUtilityComp("PARTICLES", job, sharedFolder);
    makeSharedUtilityComp("FLASH_CLOCK", job, sharedFolder);
    makeSharedUtilityComp("CAMERA_RIG", job, sharedFolder);
    var footage = input.assetPath ? importLogo(input.assetPath, assetsFolder) : null;
    var background = makeBackground(job, sharedFolder);
    var logoMaster = makeLogoMaster(job, background, footage, templatesFolder, input.flashEvents);
    var centerTemplate = null;
    var topTemplate = null;
    if (job.content.kind === "artist_batch") {
      if (wantsLayout(job, "center")) centerTemplate = makeArtistTemplate(job, background, footage, templatesFolder, input.flashEvents, "center");
      if (wantsLayout(job, "top_third")) topTemplate = makeArtistTemplate(job, background, footage, templatesFolder, input.flashEvents, "top_third");
    }

    var renderItems = [];
    var outputTemplates = [];
    var failures = [];
    if (job.content.kind === "logo_loop") {
      var logoLoopBaseName = hasLogo(job) ? "UPFORIT_LOGO_LOOP" : "UPFORIT_NO_LOGO_LOOP";
      var logoLoopLabel = hasLogo(job) ? "UPFORIT logo loop" : "UPFORIT no-logo visual loop";
      if (input.mode === "preview") {
        var logoPreview = makePreviewWrapper(logoMaster, previewsFolder);
        queueComp(
          logoPreview,
          input.intermediateRoot + "/" + logoLoopBaseName + "_PREVIEW.mov",
          logoLoopLabel + " preview",
          { preview: true }, renderItems, outputTemplates
        );
      } else {
        queueComp(
          logoMaster,
          input.intermediateRoot + "/" + logoLoopBaseName + ".mov",
          logoLoopLabel + " master",
          { preview: false }, renderItems, outputTemplates
        );
      }
    } else {
      var names = job.content.names;
      var slugs = uniqueSlugs(names);
      var count = input.mode === "preview" ? 1 : names.length;
      for (var artistIndex = 0; artistIndex < count; artistIndex += 1) {
        try {
          var center = centerTemplate ? duplicateArtistComp(centerTemplate, names[artistIndex], slugs[artistIndex], artistIndex, "center", artistsFolder) : null;
          var top = topTemplate ? duplicateArtistComp(topTemplate, names[artistIndex], slugs[artistIndex], artistIndex, "top_third", artistsFolder) : null;
          if (input.mode === "preview") {
            if (center) {
              var centerPreview = makePreviewWrapper(center, previewsFolder);
              queueComp(
                centerPreview,
                input.intermediateRoot + "/UPFORIT_ARTIST_" + slugs[artistIndex] + "_CENTER_PREVIEW.mov",
                names[artistIndex] + " — Centre preview",
                { artist: names[artistIndex], layout: "center", preview: true }, renderItems, outputTemplates
              );
            }
            if (top) {
              var topPreview = makePreviewWrapper(top, previewsFolder);
              queueComp(
                topPreview,
                input.intermediateRoot + "/UPFORIT_ARTIST_" + slugs[artistIndex] + "_TOP_THIRD_PREVIEW.mov",
                names[artistIndex] + " — Top third preview",
                { artist: names[artistIndex], layout: "top_third", preview: true }, renderItems, outputTemplates
              );
            }
          } else {
            if (center) {
              queueComp(
                center,
                input.intermediateRoot + "/UPFORIT_ARTIST_" + slugs[artistIndex] + "_CENTER.mov",
                names[artistIndex] + " — Centre master",
                { artist: names[artistIndex], layout: "center", preview: false }, renderItems, outputTemplates
              );
            }
            if (top) {
              queueComp(
                top,
                input.intermediateRoot + "/UPFORIT_ARTIST_" + slugs[artistIndex] + "_TOP_THIRD.mov",
                names[artistIndex] + " — Top third master",
                { artist: names[artistIndex], layout: "top_third", preview: false }, renderItems, outputTemplates
              );
            }
          }
        } catch (artistError) {
          failures.push({
            name: names[artistIndex],
            error: artistError && artistError.message ? artistError.message : String(artistError)
          });
        }
      }
    }

    app.project.save(new File(input.projectPath));
    app.endUndoGroup();
    writeJson(resultPath, {
      ok: true,
      projectPath: input.projectPath,
      outputTemplates: outputTemplates,
      renderItems: renderItems,
      failures: failures
    });
  } catch (error) {
    try {
      if (resultPath) {
        var errorDetail = error && error.message ? error.message : String(error);
        if (error && error.line) errorDetail += " (line " + error.line + ")";
        if (error && error.fileName) errorDetail += " in " + error.fileName;
        writeJson(resultPath, {
          ok: false,
          projectPath: "",
          outputTemplates: [],
          renderItems: [],
          failures: [],
          error: errorDetail
        });
      }
    } catch (writeError) {}
  } finally {
    try {
      if (projectWasCreated && app.project) app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    } catch (closeError) {}
    try {
      app.scheduleTask("app.quit()", 1200, false);
    } catch (scheduleQuitError) {}
  }
})();
