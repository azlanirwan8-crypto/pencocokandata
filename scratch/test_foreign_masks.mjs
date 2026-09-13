// Test coordinate bounds for Foreign Country Masks around Indonesia

export const FOREIGN_LAND_MASKS = [
  // 1. Peninsular Malaysia, Singapore & Southern Thailand
  {
    name: 'Malaysia Barat & Singapura',
    coords: [
      [1.24, 103.40],
      [1.32, 103.62],
      [1.48, 104.05],
      [1.75, 104.35],
      [6.80, 102.30],
      [7.20, 100.20],
      [6.50, 99.50],
      [3.00, 101.00],
      [1.50, 102.90],
      [1.24, 103.40],
    ]
  },
  // 2. Sarawak, Sabah & Brunei (Malaysia Timur)
  {
    name: 'Malaysia Timur (Sarawak, Sabah) & Brunei',
    coords: [
      [2.08, 109.64], // Tanjung Datu
      [1.75, 110.35],
      [1.20, 110.80],
      [0.90, 111.70],
      [1.30, 112.50],
      [1.80, 113.80],
      [2.50, 115.00],
      [4.18, 115.60],
      [4.18, 117.65], // Sebatik North Border
      [4.60, 118.50],
      [5.50, 119.00],
      [7.40, 117.30], // Kudat Tip of Borneo
      [6.00, 115.50],
      [4.90, 114.80], // Brunei
      [4.50, 114.00], // Miri
      [3.20, 113.00], // Bintulu
      [2.08, 109.64],
    ]
  },
  // 3. Papua New Guinea (East of 141° E)
  {
    name: 'Papua New Guinea',
    coords: [
      [-2.50, 141.02],
      [-2.50, 155.00],
      [-12.00, 155.00],
      [-12.00, 141.02],
      [-9.15, 141.02],
      [-6.90, 141.25], // Fly River bulge
      [-6.00, 141.02],
      [-2.50, 141.02],
    ]
  },
  // 4. Australia (Darwin / Northern Territory / Cocos)
  {
    name: 'Australia & Samudra Selatan',
    coords: [
      [-11.60, 110.00],
      [-11.60, 143.00],
      [-25.00, 143.00],
      [-25.00, 110.00],
      [-11.60, 110.00],
    ]
  },
  // 5. Philippines (Mindanao & Sulu)
  {
    name: 'Filipina (Mindanao & Kepulauan Sulu)',
    coords: [
      [5.80, 119.50],
      [10.00, 119.50],
      [10.00, 127.50],
      [5.80, 127.50],
      [5.80, 119.50],
    ]
  },
  // 6. Timor-Leste
  {
    name: 'Timor-Leste',
    coords: [
      [-8.30, 125.05],
      [-8.30, 127.40],
      [-9.35, 127.40],
      [-9.35, 125.05],
      [-8.30, 125.05],
    ]
  }
];

console.log('Total Foreign Land Masks defined:', FOREIGN_LAND_MASKS.length);
FOREIGN_LAND_MASKS.forEach(m => {
  console.log(`- ${m.name}: ${m.coords.length} points`);
});
