/**
 * Languages core can write in. Brazilian Portuguese is the source language:
 * operations return their messages in it, and figure text uses its decimal
 * comma unless the doc says otherwise.
 */
export type Locale = "pt-BR" | "en";

export const LOCALES: readonly Locale[] = ["pt-BR", "en"];

/**
 * English for the messages of the operations, the input parser and figure
 * files, keyed by the Portuguese text like a gettext catalog. A test checks
 * that every message in those files has an entry here.
 */
const EN: Record<string, string> = {
  // Shapes
  "Selecione ao menos dois pontos para ligar.": "Select at least two points to connect.",
  "Selecione ao menos três pontos para fechar um contorno.": "Select at least three points to close an outline.",
  "Esses pontos já estão ligados.": "These points are already connected.",
  "Selecione três pontos (A, B, C marca o ângulo em B) ou um polígono.":
    "Select three points (A, B, C marks the angle at B) or a polygon.",
  "Os pontos estão alinhados, não há ângulo para marcar.": "The points are collinear, so there is no angle to mark.",
  "Esses ângulos já existem.": "These angles already exist.",
  "Selecione ao menos três pontos, ou os segmentos de um contorno fechado.":
    "Select at least three points, or the segments of a closed outline.",
  "Selecione ao menos três segmentos que formem um contorno fechado.":
    "Select at least three segments that form a closed outline.",
  "Os segmentos devem formar um único contorno fechado.": "The segments must form a single closed outline.",
  "Os segmentos devem se ligar um a um, sem bifurcações nem pontas soltas.":
    "The segments must join one to one, with no branches or loose ends.",
  "Os segmentos selecionados se cruzam.": "The selected segments cross each other.",
  "Os pontos estão alinhados e não formam um polígono.": "The points are collinear and don't form a polygon.",
  "Esse polígono já existe.": "This polygon already exists.",
  "Selecione o ponto que será o centro.": "Select the point that will be the center.",
  "Selecione o centro e depois um ponto da circunferência.": "Select the center, then a point on the circle.",
  "Selecione o centro e um segmento para a circunferência tangenciar.":
    "Select the center and a segment for the circle to touch.",
  "Selecione três pontos por onde a circunferência passa.": "Select three points the circle goes through.",
  "Os três pontos estão alinhados, não há circunferência que passe por eles.":
    "The three points are collinear, so no circle goes through them.",
  "O raio ficou zero. Escolha outros pontos.": "The radius came out zero. Choose other points.",
  "Selecione um segmento.": "Select a segment.",
  "O ponto ficaria fora do segmento.": "The point would fall outside the segment.",
  "Escreva o texto.": "Write the text.",
  "As formas selecionadas já estão preenchidas.": "The selected shapes are already filled.",
  "Esse ponto não existe mais.": "That point no longer exists.",
  "Selecione segmentos, polígonos ou circunferências.": "Select segments, polygons or circles.",
  "Arcos ainda não viram funções: selecione circunferências inteiras.":
    "Arcs can't become functions yet: select whole circles.",

  // Labels
  "Não há elementos para etiquetar.": "There is nothing to label.",
  "Não há rótulos para apagar.": "There are no labels to remove.",
  "Marque o que rotular.": "Choose what to label.",

  // Constructions
  "Selecione um vértice e o lado oposto (um segmento ou dois pontos), ou um triângulo para traçar as três.":
    "Select a vertex and the opposite side (a segment or two points), or a triangle to draw all three.",
  "Selecione também o lado oposto: um segmento ou dois pontos.":
    "Also select the opposite side: a segment or two points.",
  "O ponto é vértice de mais de um triângulo. Selecione também o lado oposto.":
    "The point is a vertex of more than one triangle. Also select the opposite side.",
  "O vértice não pode ser uma ponta do lado oposto.": "The vertex can't be an end of the opposite side.",
  "As pontas do lado coincidem.": "The ends of the side are the same point.",
  "O vértice está sobre a reta do lado oposto.": "The vertex lies on the line of the opposite side.",
  "Selecione um segmento ou dois pontos.": "Select a segment or two points.",
  "Os dois pontos coincidem.": "The two points are the same point.",
  "Esse ponto médio já existe.": "This midpoint already exists.",
  "Essa altura já existe.": "This altitude already exists.",
  "Essas alturas já existem.": "These altitudes already exist.",
  "Selecione o ponto e um segmento, ou o ponto e depois dois pontos da reta.":
    "Select the point and a segment, or the point and then two points of the line.",
  "O ponto é uma ponta do segmento: ele já está sobre a reta.":
    "The point is an end of the segment, so it is already on the line.",
  "Os dois pontos da reta coincidem.": "The two points of the line are the same point.",
  "O ponto já está sobre a reta.": "The point is already on the line.",
  "Essa projeção já existe.": "This projection already exists.",
  "Essa mediana já existe.": "This median already exists.",
  "Essas medianas já existem.": "These medians already exist.",
  "Selecione um ângulo, três pontos (A, B, C traça a bissetriz em B) ou um triângulo.":
    "Select an angle, three points (A, B, C bisects the angle at B) or a triangle.",
  "Os pontos estão alinhados, não há ângulo para dividir.": "The points are collinear, so there is no angle to bisect.",
  "Essa bissetriz já existe.": "This bisector already exists.",
  "Essas bissetrizes já existem.": "These bisectors already exist.",
  "Essa mediatriz já existe.": "This perpendicular bisector already exists.",
  "Selecione uma mediatriz.": "Select a perpendicular bisector.",
  "A mediatriz não tem marca.": "The perpendicular bisector has no mark.",
  "A mediatriz já tem marca.": "The perpendicular bisector already has a mark.",
  "O comprimento precisa ser maior que zero.": "The length must be greater than zero.",
  "Selecione um ponto sobre um gráfico, ou clique com o botão direito na curva.":
    "Select a point on a graph, or right-click the curve.",
  "O gráfico não tem reta tangente nesse ponto, como num bico.":
    "The graph has no tangent line at that point, as at a corner.",
  "Essa reta tangente já existe.": "This tangent line already exists.",
  "Selecione uma reta tangente.": "Select a tangent line.",
  "A reta tangente só preenche a janela dos eixos.": "A tangent line can only fill the axes window.",
  "Selecione um arco de circunferência.": "Select a circular arc.",
  "Esse arco não tem raios.": "This arc has no radii.",
  "Esse setor já tem raios.": "This sector already has radii.",
  "Selecione uma circunferência.": "Select a circle.",
  "Selecione dois objetos que se cruzem: segmentos, circunferências, gráficos ou retas verticais.":
    "Select two objects that cross: segments, circles, graphs or vertical lines.",
  "Os objetos selecionados não se cruzam.": "The selected objects don't cross.",
  "Os objetos já se cruzam em pontos da figura.": "The objects already cross at points of the figure.",
  "Já há um ponto aí.": "There is already a point there.",
  "Os pontos selecionados já são livres.": "The selected points are already free.",

  // Graphs
  "Selecione um gráfico.": "Select a graph.",
  "Selecione os eixos.": "Select the axes.",
  "Selecione pontos.": "Select points.",
  "A figura já tem eixos.": "The figure already has axes.",
  "A figura já tem uma malha.": "The figure already has a grid.",
  "A figura não tem eixos. Insira eixos antes: Gráficos › Eixos.":
    "The figure has no axes. Insert axes first: Gráficos › Eixos.",
  "Crie uma reta numérica antes: Gráficos › Reta numérica.": "Create a number line first: Gráficos › Reta numérica.",
  "O início do intervalo precisa ser menor que o fim.": "The interval must start before it ends.",
  "O início precisa ser menor que o fim.": "The start must be less than the end.",
  "O início só pode ser -∞.": "Only the start can be -∞.",
  "O fim só pode ser +∞.": "Only the end can be +∞.",
  "Valor de x fora do limite.": "The x value is out of range.",
  "Valor fora do limite da figura.": "The value is outside the figure's limits.",
  "O ponto fica fora do limite da figura.": "The point falls outside the figure's limits.",
  "As raízes já estão marcadas.": "The roots are already marked.",
  "Os máximos e mínimos já estão marcados.": "The maxima and minima are already marked.",
  "O corte no eixo y já está marcado.": "The y-intercept is already marked.",
  "O gráfico não tem raízes na parte desenhada.": "The graph has no roots in the drawn part.",
  "O gráfico não tem máximos nem mínimos na parte desenhada.": "The graph has no maxima or minima in the drawn part.",
  "O gráfico não cruza o eixo y na parte desenhada.": "The graph doesn't cross the y-axis in the drawn part.",
  "Use um número aqui, como 2 ou pi/2.": "Use a number here, like 2 or pi/2.",

  // Input bar
  "Falta a coordenada y. Exemplo: (2;3).": "The y coordinate is missing. Example: (2;3).",
  "Falta o ângulo θ, em graus. Exemplo: (3:60).": "The angle θ in degrees is missing. Example: (3:60).",
  "Falta fechar o parêntese.": "A parenthesis is not closed.",
  "Falta fechar as aspas do texto.": "The text's quotes are not closed.",
  "O texto entre aspas está vazio.": "The quoted text is empty.",
  "Coloque um ponto antes de --.": "Put a point before --.",
  "Um -- sem ponto depois fecha o contorno: ligue ao menos três pontos antes.":
    "A -- with no point after it closes the outline: connect at least three points first.",
  "Não há ponto anterior para o deslocamento partir.": "There is no previous point for the offset to start from.",
  "Use (x;y), (R:θ), +(x;y) ou +(R:θ).": "Use (x;y), (R:θ), +(x;y) or +(R:θ).",

  // Vectors
  "Selecione ao menos dois pontos: a origem e depois a extremidade.": "Select at least two points: the tail, then the tip.",
  "Os pontos coincidem.": "The points are the same point.",
  "Esse vetor já existe.": "This vector already exists.",
  // Circuits
  "Há um gerador ideal em curto-circuito: um fio liga os seus dois polos.": "An ideal source is short-circuited: a wire joins its two terminals.",
  "O circuito não tem solução única: há um laço só de geradores ideais, amperímetros e chaves fechadas, ou geradores ideais diferentes em paralelo.":
    "The circuit has no single solution: a loop has only ideal sources, ammeters and closed switches, or different ideal sources are in parallel.",
  "Selecione dois pontos: o componente fica entre eles.": "Select two points: the component goes between them.",
  "Use um valor entre 0 e 1 000 000 000.": "Use a value from 0 to 1 000 000 000.",
  "Use uma resistência interna entre 0 e 1 000 000 000.": "Use an internal resistance from 0 to 1 000 000 000.",
  "A resistência precisa ser maior que zero. Para um fio, ligue os pontos com um segmento.":
    "The resistance must be greater than zero. For a wire, join the points with a segment.",
  "A figura não tem circuito: insira um componente primeiro.": "The figure has no circuit: insert a component first.",
  "A origem e a extremidade coincidem: esse vetor não tem direção.": "The tail and the tip are the same point, so this vector has no direction.",
  "Selecione ao menos dois vetores, na ordem da soma.": "Select at least two vectors, in the order of the sum.",
  "A soma desses vetores é nula: não há seta para desenhar.": "These vectors add up to zero, so there is no arrow to draw.",
  "Essa soma já existe.": "This sum already exists.",
  "Selecione exatamente dois vetores.": "Select exactly two vectors.",
  "Os vetores são paralelos e não formam paralelogramo. Use a regra do polígono.": "The vectors are parallel and form no parallelogram. Use the polygon rule.",
  "Selecione dois vetores: primeiro o minuendo, depois o subtraendo.": "Select two vectors: the one to subtract from, then the one to subtract.",
  "Os vetores são iguais: a diferença é nula.": "The vectors are equal, so the difference is zero.",
  "Essa diferença já existe.": "This difference already exists.",
  "Selecione dois vetores: primeiro o que será projetado, depois a direção.": "Select two vectors: the one to project, then the direction.",
  "Os vetores são perpendiculares: a projeção é nula.": "The vectors are perpendicular, so the projection is zero.",
  "Selecione um vetor.": "Select a vector.",
  "Esse versor já existe.": "This unit vector already exists.",
  "Esse vetor já está na direção de um eixo, ou as componentes já existem.": "This vector is already along an axis, or its components already exist.",
  "Esse múltiplo já existe.": "This multiple already exists.",
  "Os versores i e j já existem.": "The unit vectors i and j already exist.",
  "O vetor nulo não tem direção para desenhar.": "The zero vector has no direction to draw.",
  "Use vetor u=(3;2), vetor F=(5:30)@(1;1) ou vetor A B com pontos que existem.": "Use vetor u=(3;2), vetor F=(5:30)@(1;1), or vetor A B with existing points.",

  // Sets
  "Escreva uma expressão com os conjuntos, como A∩B.": "Write an expression with the sets, like A∩B.",
  "A expressão termina antes da hora.": "The expression ends too early.",
  "Falta o nome de um conjunto.": "A set's name is missing.",
  "Não entendi o fim da expressão. Falta U, n ou - entre os conjuntos?": "The end of the expression is unclear. Is U, n or - missing between the sets?",
  "Crie o diagrama antes, no menu Conjuntos.": "Create the diagram first, in the Conjuntos menu.",
  "Selecione ao menos dois conjuntos, ou nenhum para usar todos.": "Select at least two sets, or none to use them all.",
  "Selecione primeiro o conjunto de onde tirar, depois o que será tirado.": "Select the set to take from, then the one to take away.",
  "Use até 60 elementos em cada conjunto.": "Use up to 60 elements in each set.",
  "O diagrama tem de 1 a 3 conjuntos.": "A diagram has 1 to 3 sets.",
  "A figura já tem um diagrama. Digite A={1,2} para mudar os conjuntos dele.": "The figure already has a diagram. Type A={1,2} to change its sets.",
  "O complementar precisa de um universo: crie o diagrama em Conjuntos.": "A complement needs a universe: create the diagram in Conjuntos.",
  "Essa região está vazia na figura.": "This region is empty in the figure.",
  "Selecione duas ou mais circunferências ou polígonos.": "Select two or more circles or polygons.",
  "A exclusão é entre duas formas: selecione só duas.": "Exclusion is between two shapes: select only two.",
  "As formas não se cruzam: a interseção é vazia.": "The shapes don't cross: the intersection is empty.",
  "Essa região não é um preenchimento entre formas.": "This region isn't a fill between shapes.",
  "A exclusão é entre duas formas.": "Exclusion is between two shapes.",
  "Escreva o texto depois de texto:": "Write the text after texto:",
  "Crie o diagrama antes: o complementar precisa do universo.": "Create the diagram first: a complement needs the universe.",
  "Essa expressão ocupa mais de uma região do diagrama. Informe uma região só, como n(A∩B)=3 ou n(A−B)=2.": "This expression covers more than one region of the diagram. Give a single region, like n(A∩B)=3 or n(A−B)=2.",

  // Boards
  "Escreva a conta ou a tabela.": "Write the calculation or the chart.",
  "A figura chegou ao limite de espaço.": "The figure ran out of room.",
  "Some até 8 números de uma vez.": "Add up to 8 numbers at once.",
  "Faltam os números.": "The numbers are missing.",
  "Use números inteiros positivos.": "Use positive whole numbers.",
  "Use números de até 1 000 000 000.": "Use numbers up to 1,000,000,000.",
  "Fatore um número por vez. Para vários, use mmc.": "Factor one number at a time. For several, use mmc.",
  "Use ao menos dois números, como mmc(12; 18).": "Use at least two numbers, like mmc(12; 18).",
  "Use até 6 números.": "Use up to 6 numbers.",
  "Escreva a conta assim: conta 1234:5, conta 12+34, conta 7x8.": "Write the calculation like this: conta 1234:5, conta 12+34, conta 7x8.",
  "O algoritmo de Euclides usa dois números, como euclides(48; 18).": "Euclid's algorithm takes two numbers, like euclides(48; 18).",
  "Escreva os intervalos com U, n ou - entre eles: varal [1;3] n ]2;5[.": "Write the intervals with U, n or - between them: varal [1;3] n ]2;5[.",
  "Não entendi essa conta ou tabela.": "That calculation or chart is unclear.",
  "O resultado seria negativo: escreva o número maior primeiro.": "The result would be negative: write the larger number first.",
  "Não existe divisão por zero.": "Division by zero doesn't exist.",
  "Depois do operador vem outro intervalo, como ]2; 5[.": "Another interval comes after the operator, like ]2; 5[.",
  "Use números nas pontas do intervalo, como [1/2; 3[.": "Use numbers at the ends of the interval, like [1/2; 3[.",
  "Entre os intervalos, use U para união, n para interseção ou - para diferença.": "Between intervals, use U for union, n for intersection or - for difference.",
  "O quadro de sinais usa produtos e quocientes de polinômios, como (x-1)(x+2)/(x-3).": "A sign chart takes products and quotients of polynomials, like (x-1)(x+2)/(x-3).",
  "Escreva uma equação com um sinal de igual, como |x-1| + |x+2| = 5.": "Write an equation with one equals sign, like |x-1| + |x+2| = 5.",
  "No quadro de sinais, deixe 0 de um lado, como (x-1)(x+2) ≥ 0.": "In a sign chart, keep 0 on one side, like (x-1)(x+2) ≥ 0.",
  "Escreva o intervalo assim: em [0; 2pi].": "Write the interval like this: in [0; 2pi].",
  "Use um intervalo com começo e fim, como [0; 2pi].": "Use an interval with a start and an end, like [0; 2pi].",
  "Escreva uma equação ou inequação, como |x-1| + |x+2| = 5 ou |x-2| < 3.": "Write an equation or an inequality, like |x-1| + |x+2| = 5 or |x-2| < 3.",
  "Use ao menos um módulo, como |x-1|.": "Use at least one absolute value, like |x-1|.",
  "Use até 4 módulos diferentes.": "Use up to 4 different absolute values.",
  "Selecione uma conta ou um quadro.": "Select a worked layout.",
  "Essa parte não pode virar lacuna.": "That part can't become a gap.",
  "O módulo muda de sinal vezes demais aqui: escolha um intervalo menor, como em [0; 2pi].": "The absolute value changes sign too many times here: pick a smaller interval, like in [0; 2pi].",
  "Use um só sinal de igual ou de desigualdade.": "Use a single equal or inequality sign.",
  "Falta um dos lados da relação.": "One side of the relation is missing.",

  // Files and links
  "Não é uma figura do GeoSimples.": "This is not a GeoSimples figure.",
  "O arquivo não é uma figura do GeoSimples.": "The file is not a GeoSimples figure.",
  "O link está incompleto ou danificado.": "The link is incomplete or damaged.",
};

/** Messages with a value inside, as [Portuguese pattern, English replacement]. */
const EN_PATTERNS: [RegExp, string][] = [
  [/^A figura chegou ao limite de (\d+) elementos\.$/, "The figure reached its limit of $1 elements."],
  [/^Selecione no máximo (\d+) objetos\.$/, "Select at most $1 objects."],
  [/^A função não está definida na janela\.$/, "The function is not defined in the window."],
  [/^A função não está definida em x = (.+)\.$/, "The function is not defined at x = $1."],
  [/^(.+) não está definida na janela\.$/, "$1 is not defined in the window."],
  [/^(.+) não está definida em x = (.+)\.$/, "$1 is not defined at x = $2."],
  [/^Não há ponto chamado "(.+)"\. Para criar, use (.+)\.$/, 'There is no point named "$1". To create it, use $2.'],
  [/^Diga onde fica o texto: (.+)\.$/, "Say where the text goes: $1."],
  [/^Não entendi "(.+)"\. Use U, n, - e ' entre os nomes dos conjuntos\.$/, "\"$1\" is unclear. Use U, n, - and ' between the names of the sets."],
  [/^Não há conjunto chamado (.+) na figura\. Crie o diagrama em Conjuntos, ou digite (.+)\.$/, "There is no set named $1 in the figure. Create the diagram in Conjuntos, or type $2."],
  [/^Não há conjunto chamado (.+) na figura\.$/, "There is no set named $1 in the figure."],
  [/^O diagrama já tem o máximo de 3 conjuntos\. Não há onde pôr (.+)\.$/, "The diagram already has the maximum of 3 sets. There is no room for $1."],
  [/^Use até (\d+) caracteres\.$/, "Use up to $1 characters."],
  [/^Use números de até (\d+) algarismos\.$/, "Use numbers of up to $1 digits."],
  [/^Falta o que vem depois\. Exemplo: (.+)\.$/, "What comes next is missing. Example: $1."],
];

/** A core message in the given language. Unknown messages stay as they are. */
export function translate(text: string, locale: Locale): string {
  if (locale === "pt-BR") return text;
  const exact = EN[text];
  if (exact) return exact;
  for (const [pattern, english] of EN_PATTERNS) {
    if (pattern.test(text)) return text.replace(pattern, english);
  }
  return text;
}

/** Whether a Portuguese message has an English version, for the catalog test. */
export function hasTranslation(text: string): boolean {
  return text in EN || EN_PATTERNS.some(([pattern]) => pattern.test(text));
}
