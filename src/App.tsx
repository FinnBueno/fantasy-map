import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import Canvas from './Canvas';

type DistanceConfiguration = {
  start?: [number, number]
  end?: [number, number]
  pixelToMiles: number // divide pixels by this number to get the value in miles
}

type PathConfiguration = {
  finished: boolean
  points: { x: number, y: number }[]
}

function App() {
  const ref = useRef<HTMLDivElement>(null)
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 })
  const updateDimension = () => {
    setScreenSize(ref ? {
      width: ref?.current?.offsetWidth || 0,
      height: ref?.current?.offsetHeight || 0
    } : { width: 0, height: 0 })
  }
  useEffect(() => {
    window.addEventListener('resize', updateDimension);
    
    return () => window.removeEventListener('resize', updateDimension)
  }, [ref])

  const controlHeight = 40

  const [mode, setMode] = useState<'PAN' | 'CONFIGURE' | 'DRAW'>('PAN')
  
  const [mapImage, setImage] = useState<HTMLImageElement | undefined>(undefined)

  const [distanceConfiguration, setDistanceConfiguration] = useState<DistanceConfiguration>({ start: [0,0], end: [0,0], pixelToMiles: 0 })

  const [path, setPath] = useState<PathConfiguration>({ finished: false, points: [] })
  
  const [reload, setReload] = useState<number>(Date.now())

  const draw = (
    context: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    viewportTopLeft: { x: number, y: number },
    scale: number
  ) => {
    const squareSize = 20;

      // clear canvas but maintain transform
      const storedTransform = context.getTransform();
      context.canvas.width = context.canvas.width;
      context.setTransform(storedTransform);

      context.fillRect(
        canvasWidth / 2 - squareSize / 2,
        canvasHeight / 2 - squareSize / 2,
        squareSize,
        squareSize
      );
      if (mapImage) {
        context.drawImage(
          mapImage,
          canvasWidth / 2 - mapImage.width / 2,
          canvasHeight / 2 - mapImage.height / 2
        )
      }

      // hex grid
      console.log('Scale', scale)
      if (distanceConfiguration.pixelToMiles && mapImage && scale > 3) {
        context.lineWidth = 2
        // context.strokeRect(
        //   mapImage.width,
        //   mapImage.height
        // )
        let hexWidth = 12 * distanceConfiguration.pixelToMiles
        // console.log(hexWidth, mapImage?.width, mapImage?.height)
        const startX = canvasWidth / 2 - mapImage.width / 2
        const startY = canvasHeight / 2 - mapImage.height / 2
        const radius = hexWidth
        const heightDiffPerHex = radius * Math.sin(Math.PI / 3)

        let i = 0
        for (let y = 4; y < (mapImage?.height || 0); y += hexWidth + heightDiffPerHex - 2) {
          // context.strokeStyle = ['gray', 'red', 'blue', 'green', 'orange'][j % 5]
          context.strokeStyle = "#3f3f3f40"
          for (let x = 4; x < (mapImage?.width || 0); x += radius + radius * Math.cos(Math.PI / 3)) {
            i++
            if (
              startX + x < viewportTopLeft.x - 20 ||
              startX + x > viewportTopLeft.x + (ref!.current!.offsetWidth / scale) * 2 + 20 ||
              startY + y < viewportTopLeft.y - 20 ||
              startY + y > viewportTopLeft.y + (ref!.current!.offsetHeight / scale) * 2 + 20

            ) continue
            drawHexagon(
              startX + x,
              startY + y - 4 + (i % 2 === 0 ? 0 : heightDiffPerHex),
              radius,
              context
            )
          }
          i = 0
        }
      }

      const distance = pathDistance(path, distanceConfiguration.pixelToMiles)
      // context.arc(viewportTopLeft.x, viewportTopLeft.y, 5, 0, 2 * Math.PI);
      context.font = `${32 / scale}px serif`
      context.fillStyle = "white";
      const textWidth = context.measureText(`Pixel to Miles: 1 pixel = ${Math.floor(distanceConfiguration.pixelToMiles * 1000) / 1000} miles`).width + 20 / scale
      context.fillRect(viewportTopLeft.x, viewportTopLeft.y, textWidth, 220 / scale)
      context.fillStyle = "black";
      context.fillText(`Path distance: ${Math.floor(distance * 100) / 100} miles / ${Math.ceil(distance / 48 * 10) / 10} days`, viewportTopLeft.x + 10 / scale, viewportTopLeft.y + 35 / scale)
      context.fillText(`Zoom: ${scale}`, viewportTopLeft.x + 10 / scale, viewportTopLeft.y + 75 / scale)
      context.fillText(`TopLeft: ${Math.floor(viewportTopLeft.x)}, ${Math.floor(viewportTopLeft.y)}`, viewportTopLeft.x + 10 / scale, viewportTopLeft.y + 115 / scale)
      context.fillText(`Size: ${Math.floor(screenSize.width)}, ${Math.floor(screenSize.height)}`, viewportTopLeft.x + 10 / scale, viewportTopLeft.y + 155 / scale)
      context.fillText(`Pixel to Miles: 1 pixel = ${Math.floor(distanceConfiguration.pixelToMiles * 1000) / 1000} miles`, viewportTopLeft.x + 10 / scale, viewportTopLeft.y + 195 / scale)
      context.fill();

      
      if (distanceConfiguration?.start) {
        context.moveTo(
          distanceConfiguration.start[0] - 5,
          distanceConfiguration.start[1] - 47,
        )
        context.fillStyle = "red"
        context.arc(
          distanceConfiguration.start[0] - 5,
          distanceConfiguration.start[1] - 47,
          20,
          0,
          2 * Math.PI
        )
        context.fill()
        if (distanceConfiguration.end) {
          context.arc(
            distanceConfiguration.end[0] - 5,
            distanceConfiguration.end[1] - 47,
            20,
            0,
            2 * Math.PI
          )
          context.fill()
          context.beginPath()
          context.strokeStyle = 'red'
          context.lineWidth = 4
          context.moveTo(
            distanceConfiguration.start[0] - 5,
            distanceConfiguration.start[1] - 47
          )
          context.lineTo(
            distanceConfiguration.end[0] - 5,
            distanceConfiguration.end[1] - 47
          )
          context.closePath()
          context.stroke()
        }
      }

      if (path && path.points.length > 1) {
        const { points } = path
        let lastPoint = points[0]
        context.arc(
          lastPoint.x - 5 / scale,
          lastPoint.y - 47 / scale,
          15 / scale,
          0,
          2 * Math.PI
        )
        context.fill()
        for (let i = 1; i < points.length; i++) {
          const currPoint = points[i];
          context.beginPath()
          context.moveTo(lastPoint.x - 5 / scale, lastPoint.y - 47 / scale)
          context.lineTo(currPoint.x - 5 / scale, currPoint.y - 47 / scale)
          context.stroke()
          context.closePath()
          context.arc(
            currPoint.x - 5 / scale,
            currPoint.y - 47 / scale,
            15 / scale,
            0,
            2 * Math.PI
          )
          context.fill()
          lastPoint = currPoint
        }
      }
  }

  // on load
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setImage(img)
    }
    img.src = 'https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_LowRes.jpg'
  }, [])

  return (
      <div ref={ref} style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: 'calc(100vw - 4px)',
      height: 'calc(100vh - 4px)',
      // backgroundColor: 'red'
    }}>
      <div style={{
        width: '100vw',
        height: `${controlHeight}px`,
        backgroundColor: 'blue'
      }}>
        <button
          style={{
            height: '100%',
            backgroundColor: mode === 'PAN' ? 'gray' : 'white'
          }}
          onClick={() => setMode('PAN')}
        >
          Move/Pan
        </button>
        <button
          style={{
            height: '100%',
            backgroundColor: mode === 'CONFIGURE' ? 'gray' : 'white'
          }}
          onClick={() => setMode('CONFIGURE')}
        >
          Configure distance
        </button>
        <button
          style={{
            height: '100%',
            backgroundColor: mode === 'DRAW' ? 'gray' : 'white'
          }}
          onClick={() => setMode('DRAW')}
        >
          Draw path
        </button>
        <button
          style={{
            height: '100%'
          }}
          onClick={() => setPath({
            finished: false,
            points: []
          })}
        >
          Clear path
        </button>
        <button onClick={() => setReload(Date.now())}>
          Rerender
        </button>
      </div>
      <Canvas
        draw={draw}
        update={JSON.stringify(distanceConfiguration) + JSON.stringify(path) + reload}
        mode={mode}
        canvasHeight={screenSize.height - controlHeight}
        canvasWidth={screenSize.width}
        handleConfigure={(topLeft, { x, y }, scale) => {
          console.log('handleConfigure', topLeft, x, y, scale)
          const { start, end } = distanceConfiguration
          const newX = topLeft.x + (x * 2 / scale)
          const newY = topLeft.y + (y * 2 - controlHeight) / scale
          if (start && !end) {
            const distanceInPixels = pythagoras(start, [newX, newY])
            const pixelToMiles = calculatePixelsToMiles(start, [newX, newY])
            console.log('Total ruler in pixels', distanceInPixels)
            console.log('That is', distanceInPixels / pixelToMiles, 'in miles')
            setDistanceConfiguration({
              start,
              end: [newX, newY],
              pixelToMiles
            })
          } else {
            setDistanceConfiguration({
              start: [newX, newY],
              pixelToMiles: 0
            })
          }
        }}
        handleDraw={(ctrl, topLeft, { x, y }, scale) => {
          if (ctrl) {
            if (path.finished) {
              setPath({
                finished: false,
                points: [{
                  x: topLeft.x + (x * 2 / scale),
                  y: topLeft.y + (y * 2 - controlHeight) / scale
                }]
              })
            } else {
              setPath({
                finished: true,
                points: [
                  ...path.points,
                  {
                    x: topLeft.x + (x * 2 / scale),
                    y: topLeft.y + (y * 2 - controlHeight) / scale
                  }
                ]
              })
            }
          } else {
            console.log('handleDraw', x, y)
            setPath({
              finished: false,
              points: [
                ...path.points,
                {
                  x: topLeft.x + (x * 2 / scale),
                  y: topLeft.y + (y * 2 - controlHeight) / scale
                }
              ]
            })
          }
        }}
      />
    </div>
  );
}

const RULER_SIZE = 500 // (miles)

const pythagoras = (start: [number, number], end: [number, number]): number => {
  const x = end[0] - start[0]
  const y = end[1] - start[1]
  return Math.sqrt(x * x + y * y)
}

const calculatePixelsToMiles = (start: [number, number], end: [number, number]): number => {
  const distance = pythagoras(start, end)
  return distance / RULER_SIZE
}

const pathDistance = (path: PathConfiguration, pixelToMiles: number): number => {
  const { points } = path
  if (points.length < 2) return 0
  let lastPoint = points[0]
  let totalDistance = 0
  for (let i = 1; i < points.length; i++) {
    const currPoint = points[i];
    totalDistance += pythagoras([lastPoint.x, lastPoint.y], [currPoint.x, currPoint.y]) / pixelToMiles
    lastPoint = currPoint
  }
  return totalDistance
}

const drawHexagon = (x: number, y: number, r: number, ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    ctx.lineTo(x + r * Math.cos((Math.PI / 3) * i), y + r * Math.sin((Math.PI / 3) * i));
  }
  ctx.closePath();
  ctx.stroke();
}

export default App;
