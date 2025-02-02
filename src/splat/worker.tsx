// Based on:
//   Kevin Kwok https://github.com/antimatter15/splat
//   Quadjr https://github.com/quadjr/aframe-gaussian-splatting

export function createWorker(self: any) {
  let matrices = new Float32Array()

  function sortSplats(view: Float32Array) {
    const vertexCount = matrices.length / 16
    let threshold = -0.0001
    let maxDepth = -Infinity
    let minDepth = Infinity
    let depthList = new Float32Array(vertexCount)
    let sizeList = new Int32Array(depthList.buffer)
    let validIndexList = new Int32Array(vertexCount)
    let validCount = 0
    for (let i = 0; i < vertexCount; i++) {
      // Sign of depth is reversed
      let depth =
        view[0] * matrices[i * 16 + 12] + view[1] * matrices[i * 16 + 13] + view[2] * matrices[i * 16 + 14] + view[3]
      // Skip behind of camera and small, transparent splat
      if (depth < 0 && matrices[i * 16 + 15] > threshold * depth) {
        depthList[validCount] = depth
        validIndexList[validCount] = i
        validCount++
        if (depth > maxDepth) maxDepth = depth
        if (depth < minDepth) minDepth = depth
      }
    }

    // This is a 16 bit single-pass counting sort
    let depthInv = (256 * 256 - 1) / (maxDepth - minDepth)
    let counts0 = new Uint32Array(256 * 256)
    let starts0 = new Uint32Array(256 * 256)
    let depthIndex = new Uint32Array(validCount)

    for (let i = 0; i < validCount; i++) {
      sizeList[i] = ((depthList[i] - minDepth) * depthInv) | 0
      counts0[sizeList[i]]++
    }
    
    for (let i = 1; i < 256 * 256; i++) starts0[i] = starts0[i - 1] + counts0[i - 1]
    for (let i = 0; i < validCount; i++) depthIndex[starts0[sizeList[i]]++] = validIndexList[i]
    return depthIndex
  }

  self.onmessage = (e: { data: { method: string; key: string; view: Float32Array; matrices: Float32Array } }) => {
    if (e.data.method == 'push') {
      const new_matrices = new Float32Array(e.data.matrices)
      if (matrices === undefined) {
        matrices = new_matrices
      } else {
        const resized = new Float32Array(matrices.length + new_matrices.length)
        resized.set(matrices)
        resized.set(new_matrices, matrices.length)
        matrices = resized
      }
    }
    if (e.data.method == 'sort') {
      if (matrices !== undefined) {
        const indices = sortSplats(new Float32Array(e.data.view))
        self.postMessage({ indices, key: e.data.key }, [indices.buffer])
      }
    }
  }
}