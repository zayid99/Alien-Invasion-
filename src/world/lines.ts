// What people (and animals) say. Add your own jokes here!
export const SAY = {
  panic: ['AAAH!', 'ALIENS!', 'RUN!', 'Not again!', 'My crops!', 'Call the army!', 'Is that a UFO?!', 'Help!', 'Take him, not me!', 'Mom?!', 'I knew it!'],
  lifted: ['Put me down!', 'WHEEE?!', 'I come in peace!', 'Noooo!', 'Is this a taxi?', 'I have a family!', 'Not the probe!', 'Can I keep my phone?'],
  hide: ['Is it gone?', 'Phew…', 'Quiet night…'],
  cop: ['Freeze, saucer!', 'Requesting backup!', 'Drop the cow!', 'You have the right to remain… up there'],
  soldier: ['Open fire!', 'Target the saucer!', 'Engaging!', 'Hold the line!'],
  surrender: ['We give up!', 'Don\'t probe me!', 'All hail Zix!', 'I surrender!', 'I\'ll work for free!'],
  scientist: ['Fascinating!', 'For science!', 'Take my notes!', 'Wait, I have questions!'],
  animal: { cow: ['Moo?', 'MOOO!'], sheep: ['Baa?'], pig: ['Oink!'], chicken: ['Bawk!'], dog: ['Woof!', 'Bark bark!'], cat: ['Mrrp?'], deer: ['…!'], fox: ['Yip!'] } as Record<string, string[]>,
};
export const HUMAN_KINDS = new Set(['civilian', 'farmer', 'scientist', 'cop', 'soldier']);
export const ANIMAL_KINDS = new Set(['cow', 'sheep', 'pig', 'chicken', 'deer', 'fox', 'dog', 'cat', 'haybale', 'pumpkin']);
