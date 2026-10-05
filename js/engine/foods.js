// Indian-first dish database. Values are approximate per listed serving
// (home-style cooking); the plan scales servings to hit each meal's target.
// diet: vegan ⊂ veg ⊂ egg ⊂ nonveg. slots: b breakfast, l lunch, d dinner, s snack.

export const DISHES = [
  // breakfast
  { id: 'poha', name: 'Vegetable poha with peanuts', serving: '1 plate (200 g)', slots: 'b', diet: 'vegan', kcal: 300, p: 7, c: 50, f: 8 },
  { id: 'upma', name: 'Rava upma with vegetables', serving: '1 bowl (200 g)', slots: 'b', diet: 'vegan', kcal: 290, p: 8, c: 45, f: 9 },
  { id: 'oats-milk', name: 'Oats with milk, banana & seeds', serving: '1 bowl', slots: 'b', diet: 'veg', kcal: 360, p: 15, c: 55, f: 9 },
  { id: 'moong-chilla', name: 'Moong dal chilla with mint chutney', serving: '2 chillas', slots: 'b', diet: 'vegan', kcal: 300, p: 18, c: 38, f: 8 },
  { id: 'besan-chilla', name: 'Besan chilla with curd', serving: '2 chillas + 100 g curd', slots: 'b', diet: 'veg', kcal: 330, p: 17, c: 34, f: 13 },
  { id: 'idli-sambar', name: 'Idli with sambar', serving: '3 idli + 1 bowl sambar', slots: 'b', diet: 'vegan', kcal: 320, p: 11, c: 60, f: 4 },
  { id: 'paneer-paratha', name: 'Paneer paratha with curd', serving: '1 paratha + 100 g curd', slots: 'b', diet: 'veg', kcal: 420, p: 20, c: 42, f: 19 },
  { id: 'omelette-toast', name: '3-egg omelette with multigrain toast', serving: '3 eggs + 2 slices', slots: 'b', diet: 'egg', kcal: 400, p: 25, c: 30, f: 19 },
  { id: 'egg-bhurji-roti', name: 'Egg bhurji with rotis', serving: '3 eggs + 2 rotis', slots: 'bd', diet: 'egg', kcal: 430, p: 23, c: 38, f: 20 },
  { id: 'tofu-scramble', name: 'Tofu bhurji with toast', serving: '150 g tofu + 2 slices', slots: 'b', diet: 'vegan', kcal: 360, p: 22, c: 32, f: 15 },
  { id: 'pb-toast', name: 'Peanut butter banana toast', serving: '2 slices + 1 banana', slots: 'b', diet: 'vegan', kcal: 380, p: 13, c: 48, f: 15 },
  { id: 'curd-bowl', name: 'Hung curd bowl with fruit & nuts', serving: '200 g curd', slots: 'bs', diet: 'veg', kcal: 300, p: 18, c: 30, f: 11 },
  { id: 'chicken-sandwich', name: 'Grilled chicken sandwich', serving: '1 sandwich (100 g chicken)', slots: 'b', diet: 'nonveg', kcal: 380, p: 30, c: 38, f: 11 },

  // lunch & dinner
  { id: 'dal-roti', name: 'Dal, rotis & mixed sabzi', serving: '1 bowl dal + 2 rotis + sabzi', slots: 'ld', diet: 'vegan', kcal: 480, p: 18, c: 70, f: 12 },
  { id: 'rajma-chawal', name: 'Rajma chawal with salad', serving: '1 bowl rajma + 1 cup rice', slots: 'l', diet: 'vegan', kcal: 500, p: 18, c: 82, f: 9 },
  { id: 'chole-roti', name: 'Chole with rotis & onion salad', serving: '1 bowl chole + 2 rotis', slots: 'ld', diet: 'vegan', kcal: 510, p: 19, c: 74, f: 14 },
  { id: 'paneer-roti', name: 'Paneer curry with rotis', serving: '100 g paneer + 2 rotis', slots: 'ld', diet: 'veg', kcal: 540, p: 28, c: 44, f: 27 },
  { id: 'palak-paneer', name: 'Palak paneer with jeera rice', serving: '100 g paneer + 1 cup rice', slots: 'ld', diet: 'veg', kcal: 560, p: 24, c: 58, f: 25 },
  { id: 'soya-pulao', name: 'Soya chunk pulao with raita', serving: '1.5 cups + raita', slots: 'ld', diet: 'veg', kcal: 480, p: 30, c: 62, f: 10 },
  { id: 'khichdi', name: 'Moong dal khichdi with curd', serving: '1.5 cups + 100 g curd', slots: 'd', diet: 'veg', kcal: 440, p: 17, c: 70, f: 9 },
  { id: 'tofu-stirfry', name: 'Tofu stir-fry with brown rice', serving: '150 g tofu + 1 cup rice', slots: 'ld', diet: 'vegan', kcal: 470, p: 27, c: 55, f: 15 },
  { id: 'curd-rice', name: 'Curd rice with sprouts', serving: '1.5 cups + 1/2 cup sprouts', slots: 'l', diet: 'veg', kcal: 420, p: 16, c: 66, f: 10 },
  { id: 'dosa-sambar', name: 'Masala dosa with sambar', serving: '1 dosa + 1 bowl sambar', slots: 'ld', diet: 'vegan', kcal: 450, p: 11, c: 68, f: 15 },
  { id: 'egg-curry', name: 'Egg curry with rice', serving: '2 eggs + 1 cup rice', slots: 'ld', diet: 'egg', kcal: 520, p: 22, c: 60, f: 20 },
  { id: 'chicken-curry', name: 'Chicken curry with rice & salad', serving: '150 g chicken + 1 cup rice', slots: 'ld', diet: 'nonveg', kcal: 560, p: 42, c: 55, f: 17 },
  { id: 'chicken-tikka', name: 'Chicken tikka with rotis & salad', serving: '200 g chicken + 2 rotis', slots: 'ld', diet: 'nonveg', kcal: 520, p: 52, c: 40, f: 16 },
  { id: 'fish-curry', name: 'Fish curry with rice', serving: '150 g fish + 1 cup rice', slots: 'ld', diet: 'nonveg', kcal: 500, p: 36, c: 55, f: 14 },
  { id: 'grilled-fish', name: 'Grilled fish, sautéed veggies & roti', serving: '150 g fish + 1 roti', slots: 'd', diet: 'nonveg', kcal: 430, p: 38, c: 30, f: 16 },

  // snacks / pre- and post-workout
  { id: 'sprouts-chaat', name: 'Sprouts chaat', serving: '1 bowl (150 g)', slots: 's', diet: 'vegan', kcal: 200, p: 12, c: 30, f: 3 },
  { id: 'roasted-chana', name: 'Roasted chana', serving: '50 g', slots: 's', diet: 'vegan', kcal: 180, p: 10, c: 29, f: 3 },
  { id: 'whey-milk', name: 'Whey protein shake with milk', serving: '1 scoop + 250 ml milk', slots: 's', diet: 'veg', kcal: 240, p: 31, c: 14, f: 6 },
  { id: 'soy-milk-banana', name: 'Soy milk with banana', serving: '250 ml + 1 banana', slots: 's', diet: 'vegan', kcal: 220, p: 10, c: 34, f: 5 },
  { id: 'curd-fruit', name: 'Curd with fruit', serving: '200 g curd + 1 fruit', slots: 's', diet: 'veg', kcal: 200, p: 9, c: 28, f: 6 },
  { id: 'boiled-eggs', name: 'Boiled eggs with pepper', serving: '3 eggs', slots: 's', diet: 'egg', kcal: 210, p: 19, c: 2, f: 15 },
  { id: 'makhana-peanuts', name: 'Roasted makhana & peanuts', serving: '40 g', slots: 's', diet: 'vegan', kcal: 190, p: 7, c: 18, f: 10 },
  { id: 'paneer-tikka', name: 'Paneer tikka', serving: '100 g', slots: 's', diet: 'veg', kcal: 300, p: 20, c: 8, f: 21 },
  { id: 'chicken-salad', name: 'Chicken salad', serving: '120 g chicken', slots: 's', diet: 'nonveg', kcal: 250, p: 32, c: 8, f: 10 },
  { id: 'banana-almonds', name: 'Banana with almonds', serving: '1 banana + 15 almonds', slots: 's', diet: 'vegan', kcal: 200, p: 5, c: 29, f: 9 },
  { id: 'chaas-chana', name: 'Buttermilk with roasted chana', serving: '250 ml + 30 g', slots: 's', diet: 'veg', kcal: 210, p: 12, c: 30, f: 4 },
];

const RANK = { vegan: 0, veg: 1, egg: 2, nonveg: 3 };
export const dietAllows = (pref, dishDiet) => RANK[dishDiet] <= RANK[pref];

export const DIETS = [
  { id: 'veg', label: 'Vegetarian' },
  { id: 'egg', label: 'Eggetarian' },
  { id: 'nonveg', label: 'Non-veg' },
  { id: 'vegan', label: 'Vegan' },
];
