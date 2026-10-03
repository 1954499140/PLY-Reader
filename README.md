# PLY Reader

A lightweight Windows desktop viewer for PLY point clouds and meshes. Explore a scene from arbitrary angles, move through it with the mouse, and export the current camera view as a PNG image with optional small-gap interpolation.

**Version:** 1.1.1 · **Platform:** Windows 10 / 11, x64

## Why this project exists

I asked OpenAI Codex to build this tool for my personal needs: viewing PLY point clouds from arbitrary angles and exporting images from a chosen camera pose. I provided the requirements and feedback, while Codex generated and iteratively revised the implementation, including fixes to navigation and large-cloud interaction.

I am sharing the project in case it is useful to others with similar needs. It is a personal, Codex-built utility, not an official OpenAI product. 


## Features

- Open PLY files through a file picker or drag and drop.
- Rotate, pan, and move forward or backward along the cursor direction.
- Set the rotation center by double-clicking a point or surface.
- Switch between front, back, left, right, top, and bottom views.
- Display original RGB colors, height colors, or a uniform color.
- Adjust point size, background, reference grid, coordinate axes, and the Y/Z up axis.
- View point clouds, mesh surfaces, or wireframes when face data is available.
- Use a preview of 200,000 sampled points while interacting with large point clouds, then restore the full cloud when movement stops.
- Export PNG images from the current camera pose, using full-resolution geometry.
- Run the viewer and export images offline after installing the required runtime.

## Run on Windows

1. Extract `PLY-Studio-Windows-x64.zip`.
2. Launch `PLY-Studio.exe` from the extracted `PLY-Studio` folder.
3. Click (Open PLY), or drag a `.ply` file into the viewport.

Running the executable does not require Python, Node.js, or Go.

### Requirements

- Windows 10 or Windows 11, 64-bit x64.
- A GPU and graphics driver that support WebGL 2.
- Microsoft Edge WebView2 Runtime.

If the runtime is missing, install the Evergreen x64 runtime from the [Microsoft WebView2 download page](https://developer.microsoft.com/microsoft-edge/webview2/).

## Controls

| Input | Action |
| --- | --- |
| Left-button drag | Rotate around the current target by default (please click the object you need)|
| Right-button or middle-button drag | Pan |
| Mouse wheel | Move forward/backward along the cursor ray |
| Shift + mouse wheel | Move at one tenth of the normal speed |
| Double-click a point or surface | Set the rotation target and adjust the movement step |
| Esc | Restore left-button rotation when the image preview is closed |
| Arrow keys | Rotate; focus the viewport first |
| `+` / `-` | Move forward/backward; focus the viewport first |
| `F` | Fit the entire scene; focus the viewport first |

The left toolbar switches the left button between rotation and panning. The hint at the bottom of the viewport shows the active action. Loading a file restores rotation mode. The underlying controls' A/S/D mode shortcuts are disabled to prevent them from overriding mouse input.

The view menu is in the upper-right corner of the viewport. If a scene appears incorrectly oriented, change **向上方向** (Up axis) to Y or Z. Wheel navigation can pass through the previous rotation center; it is not restricted to approaching that center.


### What interpolation does

Interpolation fills short gaps in the 2D projection using nearby pixels with similar colors on opposite sides of the gap. It does not extrapolate into the surrounding background, infer occluded geometry, or reconstruct a 3D surface.

The exported image is a rendering, not a real camera observation. For quantitative research evaluation, leave interpolation disabled unless this processing is part of the experiment. Increasing point size can also help visualize sparse clouds.

## Supported files and limits

- PLY 1.0: ASCII, binary little-endian, and binary big-endian.
- Vertex positions (`x`, `y`, `z`), optional RGB colors, and standard face vertex indices.
- Height coloring is available when RGB is absent.
- Maximum file size: 256 MiB.
- Maximum vertex count: 8,000,000.
- Actual performance depends on geometry size, available memory, and GPU capability. Interactive subsampling currently applies to point-cloud display, not mesh rendering.
- Very large absolute coordinates may lose floating-point precision; translate such data into a local coordinate system before loading when necessary.

## Local processing

PLY parsing and rendering run locally. The application does not upload or automatically save imported PLY files. The renderer, styles, and scripts are embedded in the executable; no remote web page is required.

WebView2 maintains its local profile under the user's configuration directory in `PLYStudio/WebView2`. PNG images are written only when saved through the export dialog.

## Build from source

The release archive includes a `source/` directory. For a GitHub repository, use the contents of that directory as the repository root.

### Prerequisites

- Node.js 22.13 or newer, with npm.
- Go 1.25 or newer.
- Windows PowerShell for the provided build script.
- Internet access for the initial dependency download.

From the repository root, run:

```powershell
.\build-windows.ps1
```

The script installs the locked npm dependencies, builds the embedded frontend, checks TypeScript types, and compiles `PLY-Studio.exe` in the repository root. WebView2 is required to run the executable, but not to compile it.

For a manual Windows build:

```powershell
npm ci
npm run build
npx tsc --noEmit
$env:GOOS = "windows"
$env:GOARCH = "amd64"
$env:CGO_ENABLED = "0"
go build -buildvcs=false -trimpath -ldflags="-H windowsgui -s -w" -o PLY-Studio.exe .
```

The checked-in `resource_windows_amd64.syso` contains the application icon and manifest. If you modify either source asset, regenerate this file before building:

```powershell
go run github.com/akavel/rsrc@v0.10.2 -manifest app.manifest -ico icon.ico -arch amd64 -o resource_windows_amd64.syso
```

### Project layout

| Path | Purpose |
| --- | --- |
| `main_windows.go` | Native window, embedded page, and PNG save dialog |
| `src/viewer.ts` | Three.js rendering, camera controls, previews, and image capture |
| `src/main.ts` | Interface events and file-loading workflow |
| `src/parse.ts`, `src/parse.worker.ts` | PLY parsing and background worker |
| `src/interpolate.ts` | Optional 2D gap interpolation |
| `src/index.html`, `src/style.css` | Interface structure and styling |
| `web/index.html` | Generated offline page embedded in the executable |
| `build.mjs`, `build-windows.ps1` | Frontend and Windows build scripts |
| `tests/` | Parser, interpolation, and browser regression tests |

## Tests and validation

Install dependencies and build the frontend before running tests:

```powershell
npm ci
npm run build
npx tsc --noEmit
npm test
npx playwright install chromium
node tests/ui.mjs
```

The core tests cover PLY encodings, malformed inputs, and interpolation behavior. Browser tests cover startup, rotation with a fixed target and radius, rotation after wheel navigation, interaction-mode recovery, panning, PNG output, camera-pose preservation, and file-loading recovery.

`tests/large-cloud.mjs` is an optional regression test for the original 3,286,152-point sample. That dataset is not distributed with this project. To repeat the test, provide the matching `421005_laser_scan.ply` at `../upload/421005_laser_scan.ply`, set `TEST_CHROME` to a Chromium executable, and run:

```powershell
node tests/large-cloud.mjs
```

Validation for this release includes TypeScript checks, seven core tests, Chromium browser tests, a large-cloud regression test, and Windows x64 cross-compilation. Browser validation used software WebGL on Linux. The native executable, WebView2 integration, and native save dialog have not yet been verified on a physical Windows installation. The executable is not commercially code-signed.
