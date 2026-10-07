// Regional dishes for Indian regions and other countries, plus global basics.
// Approximate values per serving; kcal, protein, carbs, fat (g).

const D = (region) => (id, name, serving, slots, diet, kcal, p, c, f) => ({ id: `${region}-${id}`, region, name, serving, slots, diet, kcal, p, c, f });

const north = D('in-north');
const south = D('in-south');
const east = D('in-east');
const west = D('in-west');
const fr = D('fr');
const it = D('it');
const gb = D('gb');
const us = D('us');
const me = D('me');
const jp = D('jp');
const cn = D('cn');
const mx = D('mx');
const br = D('br');
const g = D('global');

export const WORLD_DISHES = [
  // ---------------- North India ----------------
  north('gobhi-paratha', 'Gobhi paratha with curd', '2 parathas + 100 g curd', 'b', 'veg', 430, 14, 55, 17),
  north('moong-paratha', 'Moong dal paratha with mint chutney', '2 parathas', 'b', 'vegan', 380, 16, 54, 11),
  north('chole-kulche', 'Chole kulche', '1 bowl chole + 1 kulcha', 'b', 'vegan', 500, 18, 78, 13),
  north('dal-makhani', 'Dal makhani (light) with rotis', '1 bowl + 2 rotis', 'ld', 'veg', 520, 20, 66, 18),
  north('kadhi-chawal', 'Kadhi chawal', '1 bowl kadhi + 1 cup rice', 'l', 'veg', 480, 15, 72, 14),
  north('tandoori-chicken', 'Tandoori chicken, rotis & salad', '200 g chicken + 2 rotis', 'ld', 'nonveg', 540, 52, 40, 17),
  north('mutton-curry', 'Lean mutton curry with rotis', '150 g mutton + 2 rotis', 'd', 'nonveg', 600, 40, 42, 28),
  north('aloo-matar-tofu', 'Matar tofu with rotis', '150 g tofu + 2 rotis', 'ld', 'vegan', 480, 26, 46, 20),
  north('egg-curry-roti', 'Punjabi egg curry with rotis', '2 eggs + 2 rotis', 'ld', 'egg', 470, 21, 44, 22),
  north('lassi', 'Salted lassi', '300 ml', 's', 'veg', 170, 9, 14, 8),
  north('paneer-roll', 'Paneer kathi roll', '1 roll', 's', 'veg', 320, 17, 30, 15),

  // ---------------- South India ----------------
  south('pesarattu', 'Pesarattu (green moong dosa) with ginger chutney', '2 pesarattu', 'b', 'vegan', 330, 17, 48, 7),
  south('ragi-dosa', 'Ragi dosa with sambar', '2 dosas + sambar', 'b', 'vegan', 340, 11, 60, 6),
  south('egg-dosa', 'Egg dosa with sambar', '2 egg dosas + sambar', 'b', 'egg', 430, 20, 52, 15),
  south('pongal', 'Ven pongal with sambar', '1.5 cups + sambar', 'b', 'veg', 410, 13, 62, 12),
  south('sambar-rice', 'Sambar rice with poriyal', '1.5 cups + vegetables', 'l', 'vegan', 480, 16, 80, 10),
  south('kerala-fish', 'Kerala fish curry with red rice', '150 g fish + 1 cup rice', 'ld', 'nonveg', 520, 36, 55, 16),
  south('chettinad', 'Chicken Chettinad with rice', '150 g chicken + 1 cup rice', 'ld', 'nonveg', 600, 40, 58, 22),
  south('avial', 'Avial, dal & rice', '1 bowl each', 'ld', 'vegan', 480, 16, 70, 14),
  south('lemon-rice', 'Lemon rice with peanuts & curd', '1.5 cups + 100 g curd', 'l', 'veg', 460, 14, 68, 15),
  south('appam-egg', 'Appam with Kerala egg roast', '2 appams + 2 eggs', 'd', 'egg', 480, 20, 56, 19),
  south('sundal', 'Chickpea sundal', '1 bowl (150 g)', 's', 'vegan', 190, 10, 28, 4),
  south('chicken-65-grilled', 'Grilled chicken 65 (dry)', '120 g chicken', 's', 'nonveg', 230, 30, 6, 9),

  // ---------------- East India ----------------
  east('chura-dahi', 'Chura with curd & banana', '1 bowl', 'b', 'veg', 360, 11, 64, 6),
  east('sattu-paratha', 'Sattu paratha with curd', '2 parathas + 100 g curd', 'b', 'veg', 440, 19, 58, 14),
  east('ghugni', 'Ghugni (yellow peas) with toast', '1 bowl + 2 slices', 'b', 'vegan', 390, 17, 62, 8),
  east('macher-jhol', 'Macher jhol with rice', '150 g fish + 1 cup rice', 'ld', 'nonveg', 520, 34, 58, 14),
  east('dalma', 'Dalma with rice', '1 bowl + 1 cup rice', 'ld', 'vegan', 470, 18, 80, 8),
  east('litti-chokha', 'Litti chokha', '2 littis + chokha', 'l', 'vegan', 520, 18, 78, 15),
  east('dim-dalna', 'Dim er dalna (egg curry) with rice', '2 eggs + 1 cup rice', 'ld', 'egg', 500, 20, 60, 19),
  east('kosha-chicken', 'Light chicken kosha with rotis', '150 g chicken + 2 rotis', 'd', 'nonveg', 560, 42, 40, 24),
  east('shukto', 'Shukto, dal & rice', '1 bowl each', 'd', 'vegan', 460, 15, 74, 11),
  east('sattu-drink', 'Sattu sharbat', '300 ml (40 g sattu)', 's', 'vegan', 190, 11, 28, 3),
  east('jhal-muri', 'Jhal muri with chana', '1 bowl', 's', 'vegan', 210, 8, 34, 5),

  // ---------------- West India ----------------
  west('thepla', 'Methi thepla with curd', '2 theplas + 100 g curd', 'b', 'veg', 380, 13, 48, 15),
  west('misal', 'Misal pav (light)', '1 bowl + 1 pav', 'b', 'vegan', 500, 20, 70, 15),
  west('handvo', 'Handvo (lentil & rice cake)', '2 pieces', 'b', 'veg', 360, 14, 50, 11),
  west('dhokla', 'Moong dal dhokla', '6 pieces', 'bs', 'veg', 280, 15, 40, 6),
  west('gujarati-thali', 'Gujarati dal, rice, rotli & shaak', 'Light thali', 'l', 'vegan', 520, 18, 84, 12),
  west('pav-bhaji', 'Pav bhaji (less butter)', '1 bowl + 2 pav', 'd', 'veg', 520, 14, 78, 17),
  west('goan-fish', 'Goan fish curry with rice', '150 g fish + 1 cup rice', 'ld', 'nonveg', 540, 36, 56, 18),
  west('kolhapuri', 'Chicken Kolhapuri with bhakri', '150 g chicken + 2 bhakri', 'ld', 'nonveg', 600, 42, 52, 22),
  west('usal-bhakri', 'Matki usal with bhakri', '1 bowl + 2 bhakri', 'ld', 'vegan', 480, 20, 72, 11),
  west('egg-bhurji-pav', 'Egg bhurji pav', '3 eggs + 2 pav', 'd', 'egg', 480, 23, 46, 21),
  west('khakhra', 'Khakhra with roasted peanuts', '2 khakhra + 20 g peanuts', 's', 'vegan', 220, 9, 26, 9),

  // ---------------- France ----------------
  fr('tartine-fromage', 'Tartine with fromage blanc & fruit', '2 slices + 150 g fromage blanc', 'b', 'veg', 330, 19, 46, 7),
  fr('omelette-herbes', 'Omelette aux fines herbes with baguette', '3 eggs + 1/4 baguette', 'b', 'egg', 420, 25, 36, 19),
  fr('tartine-avocat', 'Tartine with avocado & white beans', '2 slices', 'b', 'vegan', 370, 14, 46, 15),
  fr('poulet-roti', 'Poulet rôti, haricots verts & potatoes', '180 g chicken + sides', 'ld', 'nonveg', 560, 46, 40, 22),
  fr('nicoise', 'Salade niçoise', '1 large plate', 'l', 'nonveg', 480, 34, 26, 26),
  fr('ratatouille-lentils', 'Ratatouille with Puy lentils', '1 large bowl', 'ld', 'vegan', 440, 21, 62, 11),
  fr('quiche-legumes', 'Vegetable quiche with green salad', '1 slice + salad', 'ld', 'egg', 520, 20, 36, 32),
  fr('lentilles-chevre', 'Puy lentil salad with goat cheese', '1 large bowl', 'l', 'veg', 470, 25, 50, 18),
  fr('poisson-provencal', 'Fish à la provençale with rice', '160 g fish + 1 cup rice', 'd', 'nonveg', 520, 38, 52, 15),
  fr('boeuf-bourguignon', 'Lean boeuf bourguignon with potatoes', '1 bowl', 'd', 'nonveg', 600, 42, 44, 24),
  fr('soupe-pistou', 'Soupe au pistou with bread', '1 large bowl + bread', 'd', 'vegan', 420, 16, 62, 12),
  fr('fromage-blanc-miel', 'Fromage blanc with honey', '200 g', 's', 'veg', 190, 16, 22, 4),

  // ---------------- Italy ----------------
  it('ricotta-toast', 'Ricotta toast with tomato & basil', '2 slices + 100 g ricotta', 'b', 'veg', 340, 17, 40, 12),
  it('frittata', 'Spinach frittata with toast', '3 eggs + 1 slice', 'b', 'egg', 400, 25, 22, 23),
  it('porridge-fichi', 'Oat porridge with almonds & figs', '1 bowl (oat milk)', 'b', 'vegan', 380, 12, 58, 12),
  it('pasta-fagioli', 'Pasta e fagioli', '1 large bowl', 'ld', 'vegan', 520, 22, 82, 10),
  it('cacciatore', 'Chicken cacciatore with polenta', '180 g chicken + polenta', 'ld', 'nonveg', 560, 44, 48, 18),
  it('pesce-cannellini', 'Grilled fish with cannellini & greens', '160 g fish + beans', 'ld', 'nonveg', 480, 40, 34, 18),
  it('pasta-ceci', 'Wholewheat pasta al pomodoro with chickpeas', '1 large plate', 'ld', 'vegan', 540, 22, 88, 11),
  it('risotto-funghi', 'Mushroom risotto with parmesan', '1 plate', 'd', 'veg', 560, 17, 82, 17),
  it('polpette', 'Turkey meatballs with pasta & tomato', '1 plate', 'd', 'nonveg', 600, 42, 66, 17),
  it('minestrone', 'Minestrone with bread', '1 large bowl + bread', 'l', 'vegan', 420, 16, 66, 10),
  it('ricotta-berries', 'Ricotta with berries', '150 g', 's', 'veg', 210, 12, 14, 12),
  it('bresaola', 'Bresaola with rocket & parmesan', '60 g bresaola', 's', 'nonveg', 170, 25, 2, 7),

  // ---------------- United Kingdom ----------------
  gb('porridge', 'Porridge with berries & seeds', '1 bowl (oat milk)', 'b', 'vegan', 360, 12, 56, 10),
  gb('poached-eggs', 'Poached eggs on wholemeal toast', '2 eggs + 2 slices', 'b', 'egg', 360, 22, 34, 14),
  gb('beans-toast', 'Baked beans on wholemeal toast', '1/2 tin + 2 slices', 'b', 'vegan', 380, 17, 64, 5),
  gb('jacket-tuna', 'Jacket potato with tuna & salad', '1 potato + 1 tin tuna', 'l', 'nonveg', 480, 36, 60, 8),
  gb('roast-chicken', 'Roast chicken, vegetables & potatoes', '180 g chicken + sides', 'd', 'nonveg', 580, 46, 46, 20),
  gb('fish-peas', 'Grilled fish with peas & new potatoes', '170 g fish + sides', 'ld', 'nonveg', 520, 40, 50, 14),
  gb('lentil-shepherds', 'Lentil & vegetable shepherd’s pie', '1 large portion', 'ld', 'vegan', 480, 22, 70, 12),
  gb('chickpea-curry', 'Chickpea & spinach curry with rice', '1 bowl + 1 cup rice', 'ld', 'vegan', 520, 18, 84, 12),
  gb('cheese-bean-potato', 'Jacket potato with beans & cheese', '1 potato + beans + 30 g cheese', 'l', 'veg', 520, 23, 76, 13),
  gb('cottage-oatcakes', 'Cottage cheese on oatcakes', '150 g + 3 oatcakes', 's', 'veg', 210, 17, 20, 7),

  // ---------------- United States ----------------
  us('egg-white-turkey', 'Egg-white omelette with turkey & toast', '5 whites + 60 g turkey + toast', 'b', 'nonveg', 380, 36, 30, 10),
  us('yogurt-parfait', 'Greek yogurt parfait', '250 g yogurt + granola + berries', 'b', 'veg', 350, 24, 44, 8),
  us('avocado-eggs', 'Avocado toast with eggs', '2 slices + 2 eggs', 'b', 'egg', 430, 20, 34, 24),
  us('tofu-burrito', 'Tofu breakfast burrito', '1 burrito', 'b', 'vegan', 450, 24, 50, 16),
  us('chicken-salad-bowl', 'Grilled chicken salad bowl with quinoa', '180 g chicken + quinoa', 'l', 'nonveg', 500, 46, 38, 17),
  us('turkey-chili', 'Turkey chili with beans', '1 large bowl', 'ld', 'nonveg', 520, 42, 46, 17),
  us('burrito-bowl', 'Black bean & quinoa burrito bowl', '1 bowl', 'ld', 'vegan', 540, 22, 86, 13),
  us('salmon-sweet-potato', 'Salmon, sweet potato & broccoli', '150 g salmon + sides', 'd', 'nonveg', 560, 38, 46, 23),
  us('lean-burger', 'Lean beef burger with side salad', '1 burger', 'd', 'nonveg', 620, 40, 48, 28),
  us('bean-burger', 'Bean burger with side salad', '1 burger', 'ld', 'vegan', 520, 22, 70, 16),
  us('mac-broccoli', 'Mac & cheese with broccoli', '1 bowl', 'd', 'veg', 560, 23, 70, 20),
  us('jerky-apple', 'Beef jerky & an apple', '40 g jerky + 1 apple', 's', 'nonveg', 210, 18, 28, 3),
  us('cottage-pineapple', 'Cottage cheese with pineapple', '200 g + 1/2 cup', 's', 'veg', 200, 22, 20, 4),

  // ---------------- Middle East ----------------
  me('foul', 'Foul medames with pita', '1 bowl + 1 pita', 'b', 'vegan', 420, 20, 62, 10),
  me('shakshuka', 'Shakshuka with bread', '2 eggs + 1 slice', 'b', 'egg', 420, 22, 36, 20),
  me('labneh-plate', 'Labneh, olives, cucumber & pita', '100 g labneh + pita', 'b', 'veg', 380, 17, 40, 17),
  me('shawarma-plate', 'Chicken shawarma plate with salad', '180 g chicken + salad + 1/2 pita', 'ld', 'nonveg', 580, 46, 44, 22),
  me('falafel-wrap', 'Baked falafel wrap with tahini', '1 wrap', 'l', 'vegan', 540, 20, 64, 22),
  me('mujaddara', 'Mujaddara (lentils & rice) with salad', '1 large plate', 'ld', 'vegan', 520, 20, 82, 12),
  me('kofta-tabbouleh', 'Grilled kofta with tabbouleh', '4 kofta + salad', 'd', 'nonveg', 560, 38, 30, 30),
  me('samak-harra', 'Grilled spiced fish with rice & salad', '170 g fish + rice', 'ld', 'nonveg', 520, 38, 54, 15),
  me('hummus-bowl', 'Hummus bowl with chickpeas & vegetables', '1 bowl + 1/2 pita', 'd', 'vegan', 480, 20, 56, 20),
  me('dates-almonds', 'Dates & almonds', '3 dates + 15 almonds', 's', 'vegan', 210, 5, 30, 9),
  me('laban', 'Laban (yogurt drink)', '300 ml', 's', 'veg', 160, 9, 13, 8),

  // ---------------- Japan ----------------
  jp('tamagoyaki-set', 'Tamagoyaki, rice & miso soup', '3-egg tamagoyaki + 1 cup rice', 'b', 'egg', 430, 21, 56, 12),
  jp('natto-set', 'Natto, rice & miso soup', '1 pack natto + 1 cup rice', 'b', 'vegan', 400, 20, 62, 8),
  jp('salmon-set', 'Grilled salmon breakfast set', '100 g salmon + rice + miso', 'b', 'nonveg', 480, 32, 50, 15),
  jp('teriyaki-bowl', 'Chicken teriyaki bowl', '170 g chicken + 1 cup rice', 'ld', 'nonveg', 580, 42, 70, 13),
  jp('poke', 'Salmon poke bowl', '120 g salmon + rice + edamame', 'l', 'nonveg', 540, 36, 58, 17),
  jp('soba-tofu', 'Soba with tofu & edamame', '1 bowl', 'ld', 'vegan', 480, 25, 70, 10),
  jp('oyakodon', 'Oyakodon (chicken & egg rice bowl)', '1 bowl', 'd', 'nonveg', 600, 38, 76, 14),
  jp('tofu-curry', 'Japanese vegetable curry with tofu & rice', '1 plate', 'd', 'vegan', 560, 21, 82, 15),
  jp('miso-fish', 'Miso-glazed fish with rice & greens', '160 g fish + rice', 'd', 'nonveg', 520, 37, 56, 14),
  jp('onigiri-tuna', 'Tuna onigiri', '2 onigiri', 's', 'nonveg', 260, 14, 46, 3),

  // ---------------- China ----------------
  cn('congee-egg', 'Congee with egg & greens', '1 large bowl + 1 egg', 'b', 'egg', 330, 14, 50, 7),
  cn('baozi-soymilk', 'Vegetable baozi with soy milk', '2 baozi + 300 ml soy milk', 'b', 'vegan', 400, 16, 62, 9),
  cn('kung-pao', 'Kung pao chicken with rice', '150 g chicken + 1 cup rice', 'ld', 'nonveg', 600, 38, 66, 20),
  cn('mapo-tofu', 'Vegan mapo tofu with rice', '200 g tofu + 1 cup rice', 'ld', 'vegan', 520, 24, 64, 18),
  cn('steamed-fish', 'Steamed fish with ginger, rice & bok choy', '170 g fish + rice', 'd', 'nonveg', 500, 38, 56, 12),
  cn('tomato-egg', 'Tomato & egg stir-fry with rice', '3 eggs + 1 cup rice', 'ld', 'egg', 480, 21, 64, 15),
  cn('beef-broccoli', 'Beef & broccoli with rice', '150 g beef + 1 cup rice', 'd', 'nonveg', 560, 36, 60, 18),
  cn('tofu-noodles', 'Tofu & vegetable stir-fry noodles', '1 plate', 'l', 'vegan', 520, 21, 74, 15),
  cn('tea-eggs', 'Tea eggs', '2 eggs', 's', 'egg', 150, 13, 2, 10),
  cn('soy-milk', 'Unsweetened soy milk with a pear', '300 ml + 1 pear', 's', 'vegan', 200, 10, 30, 5),

  // ---------------- Mexico ----------------
  mx('rancheros', 'Huevos rancheros', '2 eggs + 2 tortillas + beans', 'b', 'egg', 460, 23, 46, 20),
  mx('bean-tacos', 'Black bean breakfast tacos', '3 small tacos', 'b', 'vegan', 420, 18, 62, 12),
  mx('chilaquiles', 'Chilaquiles with beans & queso fresco', '1 plate', 'b', 'veg', 480, 19, 56, 20),
  mx('fajitas', 'Chicken fajitas with tortillas', '180 g chicken + 3 tortillas', 'ld', 'nonveg', 560, 44, 50, 19),
  mx('bean-rice-bowl', 'Black bean & rice bowl with salsa', '1 bowl', 'ld', 'vegan', 520, 20, 88, 10),
  mx('fish-tacos', 'Grilled fish tacos with slaw', '3 tacos', 'ld', 'nonveg', 500, 34, 50, 17),
  mx('tinga', 'Chicken tinga tostadas', '3 tostadas', 'l', 'nonveg', 480, 36, 42, 18),
  mx('enchiladas', 'Vegetable enchiladas with cheese', '2 enchiladas', 'd', 'veg', 540, 22, 60, 22),
  mx('pozole', 'Chicken pozole', '1 large bowl', 'd', 'nonveg', 450, 33, 46, 13),
  mx('guacamole', 'Guacamole with vegetable sticks', '80 g guacamole', 's', 'vegan', 200, 4, 14, 16),
  mx('queso-fruta', 'Queso fresco with fruit', '60 g cheese + fruit', 's', 'veg', 210, 12, 18, 10),

  // ---------------- Brazil ----------------
  br('tapioca-egg', 'Tapioca crepe with egg & cheese', '1 crepe', 'b', 'egg', 380, 18, 46, 14),
  br('eggs-papaya', 'Scrambled eggs, bread & papaya', '2 eggs + 1 roll + fruit', 'b', 'egg', 400, 21, 46, 15),
  br('acai-bowl', 'Açaí bowl with granola & seeds', '1 bowl', 'b', 'vegan', 420, 10, 62, 15),
  br('prato-feito', 'Arroz, feijão & grilled chicken', '150 g chicken + rice + beans', 'ld', 'nonveg', 600, 44, 70, 14),
  br('feijoada', 'Lean feijoada with greens & orange', '1 plate', 'd', 'nonveg', 620, 38, 66, 22),
  br('tofu-feijao', 'Rice, beans & farofa with tofu', '1 plate', 'ld', 'vegan', 560, 23, 80, 15),
  br('moqueca', 'Moqueca (fish stew) with rice', '170 g fish + rice', 'ld', 'nonveg', 560, 37, 54, 20),
  br('vitamina', 'Banana & oat vitamina', '300 ml', 's', 'veg', 260, 10, 44, 5),
  br('castanhas', 'Brazil nuts & fruit', '4 nuts + 1 fruit', 's', 'vegan', 210, 4, 22, 13),

  // ---------------- Global basics (fallback for every country) ----------------
  g('pb-oatmeal', 'Peanut butter oatmeal with banana', '1 bowl (plant milk)', 'b', 'vegan', 420, 14, 60, 14),
  g('scrambled-toast', 'Scrambled eggs on toast', '3 eggs + 2 slices', 'b', 'egg', 420, 25, 32, 20),
  g('greek-yogurt', 'Greek yogurt with berries & granola', '250 g', 'b', 'veg', 340, 23, 40, 9),
  g('grilled-chicken-rice', 'Grilled chicken, rice & vegetables', '180 g chicken + 1 cup rice', 'ld', 'nonveg', 540, 46, 56, 12),
  g('lentil-stew', 'Lentil & vegetable stew with bread', '1 large bowl + 1 slice', 'ld', 'vegan', 460, 22, 72, 8),
  g('chickpea-quinoa', 'Chickpea & quinoa bowl', '1 bowl', 'ld', 'vegan', 490, 20, 70, 14),
  g('omelette-salad', 'Vegetable omelette with salad & bread', '3 eggs + salad + 1 slice', 'ld', 'egg', 430, 26, 26, 24),
  g('protein-shake', 'Protein shake with milk', '1 scoop + 250 ml milk', 's', 'veg', 240, 31, 14, 6),
  g('hummus-veg', 'Hummus with vegetable sticks', '80 g hummus', 's', 'vegan', 200, 7, 18, 11),
  g('edamame', 'Edamame', '1 cup (150 g)', 's', 'vegan', 190, 17, 14, 8),
  g('boiled-eggs', 'Boiled eggs', '3 eggs', 's', 'egg', 210, 19, 2, 15),
  g('apple-pb', 'Apple with peanut butter', '1 apple + 1 tbsp', 's', 'vegan', 200, 5, 28, 9),
];
