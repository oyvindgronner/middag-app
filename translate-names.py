#!/usr/bin/env python3
# translate-names.py — erstatter engelske oppskriftsnavn med norske
# Kjøres på serveren: python3 translate-names.py
import re, os

BASE = os.path.expanduser('~/middag-backend/meals')

# Engelske navn → norske navn (alle 79 TheMealDB-oppskrifter)
NAMES = {
    # Fisk (20)
    'Fiskesuppe (Creamy Norwegian Fish Soup)': 'Kremet norsk fiskesuppe',
    'Laksa King Prawn Noodles': 'Laksa med jumboreker og nudler',
    'Mee goreng mamak': 'Stekte nudler med sjømat',
    'Thai-style fish broth with greens': 'Thai-inspirert fiskekraft med grønnsaker',
    'Spicy Thai prawn noodles': 'Krydret thainudler med reker',
    'Thai curry noodle soup': 'Thai curry-suppe med nudler',
    'Recheado Masala Fish': 'Indisk masalafisk',
    'Fish Stew with Rouille': 'Provençalsk fiskegryte med rouille',
    'Jamaican Pepper Shrimp': 'Jamaicanske pepperreker',
    'Saltfish and Ackee': 'Saltet fisk med ackee',
    'Portuguese fish stew (Caldeirada de peixe)': 'Portugisisk fiskegryte (caldeirada)',
    'Gambas al ajillo': 'Spanske hvitløksreker',
    'Arroz con gambas y calamar': 'Ris med reker og blekksprut',
    'Tom yum (hot & sour) soup with prawns': 'Tom yum-suppe med reker',
    'Salmon noodle soup': 'Laksesuppe med nudler',
    'Salt cod tortilla': 'Spansk omelett med tørrfisk',
    'Squid, chickpea & chorizo salad': 'Salat med blekksprut, kikerter og chorizo',
    'Noodle bowl salad': 'Nudelsalat med grønnsaker',
    'Tuna and Egg Briks': 'Tunfisk- og eggruller',
    'Prawn & noodle salad with crispy shallots': 'Rekesalat med nudler og sprø sjalottløk',
    # Kjøtt (40)
    'Steak & Vietnamese noodle salad': 'Biff med vietnamesisk nudelsalat',
    'Egyptian Fatteh': 'Egyptisk fatteh med lam',
    'Moussaka': 'Moussaka',
    'Croatian lamb peka': 'Kroatisk lammepeka',
    'Beef Mandi': 'Arabisk oksemandi med ris',
    'Traditional Croatian Goulash': 'Tradisjonell kroatisk goulash',
    'Beef Lo Mein': 'Kinesiske nudler med oksekjøtt',
    'Empanadas': 'Argentinske empanadas',
    'Carbonada Criolla': 'Argentinsk kjøttgryte',
    'Arepa pelua': 'Arepa med kjøttfyll',
    'Thai chicken cakes with sweet chilli sauce': 'Thai-kyllingkaker med søt chilisaus',
    'Shawarma': 'Shawarma',
    'Chick-Fil-A Sandwich': 'Sprø kyllingburger',
    'Rappie Pie': 'Kanadisk potet- og kjøttpaipai',
    'Chicken & mushroom Hotpot': 'Kylling- og soppgryte',
    'Chicken Alfredo Primavera': 'Kylling alfredo med grønnsaker',
    'Pad See Ew': 'Stekte nudler med kylling (pad see ew)',
    'Rosol (Polish Chicken Soup)': 'Polsk kyllingsuppe (rosol)',
    'Sweet and Sour Chicken': 'Søt og sur kylling',
    'Nutty Chicken Curry': 'Kyllingcurry med nøtter',
    'General Tsos Chicken': 'General Tso sin kylling',
    'Ayam Percik': 'Malaysisk grillkylling',
    'Venezuelan Coconut Chicken': 'Venezuelansk kokoskylling',
    'Smoky chicken skewers': 'Røkte kyllingspyd',
    'Chicken Fajita Mac and Cheese': 'Kyllingfajita mac and cheese',
    'McSinghs Scotch pie': 'Skotsk kjøttpai',
    'Keleya Zaara': 'Tunisisk lammegryte med oliven',
    'kofta burgers': 'Koftaburgere',
    'Imam bayildi with BBQ lamb & tzatziki': 'Grillede lammekjøtt med imam bayildi og tzatziki',
    'Lamb Pilaf (Plov)': 'Lammepilaf (plov)',
    'Lamb Tzatziki Burgers': 'Lammeburgere med tzatziki',
    'Chilli ginger lamb chops': 'Lammekotelettar med chili og ingefær',
    'Lamb & apricot meatballs': 'Lammekjøttboller med aprikos',
    'Choripán': 'Argentinsk choripán',
    'Spaghetti with Spanish flavours': 'Spansk-inspirert spaghetti',
    'Jamon & wild garlic croquetas': 'Jamón og hvitløkskroketter',
    'BBQ Pork Sloppy Joes': 'BBQ-svinekjøtt sloppy joes',
    'Torta de fiambre': 'Meksikansk kjøttsandwich',
    'Pork rib bortsch': 'Bortsjsuppe med svineribbe',
    'Slow-roasted ham with lemon, garlic & sage': 'Langstekt skinke med sitron, hvitløk og salvie',
    # Vegetar (12)
    'Beetroot Soup (Borscht)': 'Rødbetsuppe (bortsj)',
    'Provençal Omelette Cake': 'Provençalsk omelettkake',
    'Sauerkraut pierogii': 'Surkålpierogi',
    'Roasted Eggplant With Tahini, Pine Nuts, and Lentils': 'Ovnsbakt aubergine med tahini, pinjekjerner og linser',
    'Griddled aubergines with sesame dressing': 'Grillet aubergine med sesamdressing',
    'Beetroot latkes': 'Rødbetlatkes',
    'Nordic smørrebrød with asparagus and horseradish cream': 'Nordisk smørbrød med asparges og pepperrotkrem',
    'Gigantes Plaki': 'Greske ovnsbakte kjempebønner',
    'Thai rice noodle salad': 'Thainudelsalat med risnudler',
    'Vegetarian Chilli': 'Vegetarisk chili',
    'Egg Drop Soup': 'Kinesisk eggesuppe',
    'Eggplant Adobo': 'Aubergine adobo',
    # Vegansk (7)
    'Vegan Lasagna': 'Vegansk lasagne',
    'Padron peppers': 'Stekte padronpaprika',
    'Fasoliyyeh Bi Z-Zayt (Syrian Green Beans with Olive Oil)': 'Syriske grønne bønner i olivenolje',
    'Vegan banh mi': 'Vegansk bánh mì',
    'Roast fennel and aubergine paella': 'Paella med fennikel og aubergine',
    'Vegan Chocolate Cake': 'Vegansk sjokoladekake',
    'Red onion pickle': 'Syltet rødløk',
}

def translate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = 0
    for en, no in NAMES.items():
        escaped = re.escape(en)
        new_content = re.sub(r'(name:\s*")' + escaped + r'"', r'\g<1>' + no + '"', content)
        if new_content != content:
            content = new_content
            changed += 1

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return changed

files = [
    'meals-fish.js',
    'meals-meat.js',
    'meals-vegetarian.js',
    'meals-vegan.js',
]

total = 0
for fn in files:
    path = os.path.join(BASE, fn)
    n = translate_file(path)
    print(f'  {fn}: {n} navn oversatt')
    total += n

print(f'\nTotalt: {total} navn oversatt')
print('Restart backend: pm2 restart middag-backend')
