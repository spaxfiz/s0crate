/* global React */
const { useState, useEffect, useRef, useMemo } = React;

/* ─────────────────── Mock data ─────────────────── */

const SESSIONS = [
  { id: 's1', name: '理解经济学基础', topic: 'Foundations of Economics', date: '2026·05·03', progress: [3, 12], active: true },
  { id: 's2', name: '机器学习入门', topic: 'Intro to Machine Learning', date: '2026·04·28', progress: [8, 14] },
  { id: 's3', name: 'Rust 所有权模型', topic: 'Rust Ownership Model', date: '2026·04·21', progress: [12, 12] },
  { id: 's4', name: '古希腊哲学溯源', topic: 'Pre-Socratic Philosophy', date: '2026·04·17', progress: [2, 9] },
  { id: 's5', name: '量子力学直觉', topic: 'Quantum Intuitions', date: '2026·03·30', progress: [0, 11] },
];

const SYLLABUS = [
  { id: 'n1', num: 'I', title: '稀缺与选择',  desc: '一切经济学的起点：资源有限，欲望无穷。', status: 'completed',
    children: [
      { id: 'n1.1', num: '1', title: '机会成本',  desc: '"放弃的最高代价"', status: 'completed' },
      { id: 'n1.2', num: '2', title: '边际思维',  desc: '在边缘上做决定', status: 'completed' },
      { id: 'n1.3', num: '3', title: '激励反应',  desc: '人们如何回应激励', status: 'completed' },
    ]},
  { id: 'n2', num: 'II', title: '供给与需求', desc: '看不见的手如何在市场中运作。', status: 'in_progress',
    children: [
      { id: 'n2.1', num: '1', title: '需求曲线',     desc: '价格与数量的反向舞蹈', status: 'completed' },
      { id: 'n2.2', num: '2', title: '供给曲线',     desc: '生产者的回应', status: 'in_progress', current: true },
      { id: 'n2.3', num: '3', title: '市场均衡',     desc: '两条曲线的相遇之处', status: 'pending' },
      { id: 'n2.4', num: '4', title: '弹性',         desc: '对价格变动的敏感程度', status: 'pending' },
    ]},
  { id: 'n3', num: 'III', title: '消费者与厂商', desc: '微观决策的两个主角。', status: 'pending',
    children: [
      { id: 'n3.1', num: '1', title: '效用最大化', desc: '消费者的取舍', status: 'pending' },
      { id: 'n3.2', num: '2', title: '成本结构',   desc: '固定与可变之分', status: 'pending' },
      { id: 'n3.3', num: '3', title: '完全竞争',   desc: '理想化的市场', status: 'pending' },
    ]},
  { id: 'n4', num: 'IV', title: '市场失灵', desc: '看不见的手并非万能。', status: 'pending',
    children: [
      { id: 'n4.1', num: '1', title: '外部性',   desc: '溢出的成本与收益', status: 'pending' },
      { id: 'n4.2', num: '2', title: '公共品',   desc: '非排他与非竞争', status: 'pending' },
    ]},
  { id: 'n5', num: 'V', title: '宏观视野', desc: '从个体到整体经济。', status: 'pending',
    children: [
      { id: 'n5.1', num: '1', title: 'GDP 与衡量', desc: '一个国家的产出', status: 'pending' },
      { id: 'n5.2', num: '2', title: '通货膨胀',   desc: '钱的购买力变化', status: 'pending' },
    ]},
];

/* Flatten for navigation */
const FLAT_NODES = (() => {
  const out = [];
  SYLLABUS.forEach(p => {
    out.push({ ...p, parentTitle: null });
    p.children?.forEach(c => out.push({ ...c, parentTitle: p.title, parentId: p.id }));
  });
  return out;
})();

const CURRENT_NODE = FLAT_NODES.find(n => n.current) || FLAT_NODES.find(n => n.id === 'n2.2');

/* Conversation transcripts per phase */
const TRANSCRIPTS = {
  questioning: [
    { role: 'assistant', content: '欢迎来到 Socrate。在我们一起踏上学习之旅前，我想先了解你。\n\n**你之前接触过经济学相关的内容吗？**',
      options: [
        { label: '完全没有', value: '完全没有，从零开始' },
        { label: '听过一些概念', value: '听过一些经济学概念，比如供需、通胀' },
        { label: '修过课但忘了', value: '本科修过原理课，但已经忘得差不多' },
        { label: '自定义...', value: '', type: 'custom' },
      ]},
    { role: 'user', content: '听过一些经济学概念，比如供需、通胀' },
    { role: 'assistant', content: '很好——你已经握有几个最重要的钥匙了。\n\n那么，**你希望最终能用这些知识做什么？** 不同的目标会通往不同的路径。',
      options: [
        { label: '看懂新闻', value: '能看懂经济新闻和评论文章' },
        { label: '做投资决策', value: '为个人投资和理财提供思维框架' },
        { label: '学术兴趣', value: '出于纯粹的学术好奇' },
        { label: '指导工作', value: '让经济学帮我做更好的商业决策' },
        { label: '自定义...', value: '', type: 'custom' },
      ]},
    { role: 'user', content: '能看懂经济新闻和评论文章' },
    { role: 'assistant', content: '理解了。那么最后一个问题——**你更喜欢哪种学习方式？**',
      options: [
        { label: '从原理出发', value: '我喜欢先理解基本原理，再看应用' },
        { label: '从案例出发', value: '我喜欢从真实案例反推概念' },
        { label: '穿插进行', value: '理论和案例交替进行' },
        { label: '自定义...', value: '', type: 'custom' },
      ]},
  ],
  deepDive: [
    { role: 'assistant', content: '欢迎来到 **供给曲线**。\n\n在我开口之前，让我先抛出一个问题：\n\n> 假设你是一个面包师傅。如果城里突然每个面包能卖到 50 元（原来 10 元），**你接下来一周会怎么做？**',
      options: [
        { label: '维持产量', value: '我会继续按原来的产量生产' },
        { label: '加班多做', value: '我会加班加点，多做一些' },
        { label: '招人扩产', value: '我会招人甚至扩建烤炉' },
        { label: '自定义...', value: '', type: 'custom' },
      ]},
    { role: 'user', content: '我会加班加点，多做一些' },
    { role: 'assistant', content: '完全合理——而你刚刚**亲手画出了供给曲线**。\n\n注意你的逻辑链：\n\n1. **价格上升** → 利润空间变大\n2. **激励变强** → 你愿意承担更高的边际成本（加班费、夜班）\n3. **数量增加** → 市场上的面包变多\n\n这就是 *"价格越高，供给量越大"* 的全部秘密。把无数个"你"画在一张图上，就得到了一条**向右上方倾斜**的曲线。\n\n但这里有一个微妙之处值得停下来想想：',
      streamEnd: true,
      options: [
        { label: '继续讲下去', value: '我理解了，请继续' },
        { label: '举个例子', value: '能再举一个具体的例子吗？' },
        { label: '深入原理', value: '我想深入了解一下背后的边际成本原理' },
        { label: '和需求的关系', value: '这个和之前学的需求曲线有什么关系？' },
        { label: '自定义...', value: '', type: 'custom' },
      ]},
  ],
  summary: [
    { role: 'assistant', content: '在我们正式收尾之前，我想先问问你——\n\n> **回望这次学习，对你启发最大的是哪一个概念？**',
      options: [
        { label: '机会成本', value: '机会成本——意识到一切选择都有代价' },
        { label: '边际思维', value: '边际思维——在边缘上做决定的思维方式' },
        { label: '看不见的手', value: '市场如何在没有指挥的情况下达到均衡' },
        { label: '自定义...', value: '', type: 'custom' },
      ]},
  ],
};

window.SocrateData = { SESSIONS, SYLLABUS, FLAT_NODES, CURRENT_NODE, TRANSCRIPTS };
