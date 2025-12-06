'use client'

import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import { useRef } from 'react'

// Expert data
const experts = [
  {
    id: 'evo',
    name: 'Dr. Evo',
    title: 'Evolutionary Biologist',
    color: '#4ade80', // green
    avatar: '🧬',
    problem: `The fundamental problem is that dating apps have created an environment that's evolutionarily novel and maladaptive. Humans evolved for small-group mate selection—you'd evaluate maybe 50-100 potential partners in your lifetime. Now people see 50 in 10 minutes.`,
    detail: `Women's evolved selectivity (because pregnancy is costly) gets amplified to pathological levels—they swipe right on only 5-8% of profiles. Men's evolved tendency to pursue multiple partners becomes mass-swiping on 40-46% of profiles. Both strategies that made sense in small groups become dysfunctional at scale.`,
    stat: `Women find 80% of men "below average" attractiveness on apps. That's not biology—that's contrast effect from seeing too many options too fast.`,
    solution: [
      'Limit the pool — Humans can meaningfully evaluate maybe 5-7 options at a time',
      'Slow down evaluation — In nature, you observe someone over time, not in 7 seconds',
      'Multi-dimensional assessment — Attraction evolved to assess health, resources, personality, compatibility—not just photos',
    ],
  },
  {
    id: 'neuro',
    name: 'Dr. Neuro',
    title: 'Neurobiologist',
    color: '#f472b6', // pink
    avatar: '🧠',
    problem: `The apps are literally hijacking the dopamine system. Dopamine rises TWICE as much in anticipation of a match than actually getting one. That's the same mechanism as slot machines.`,
    detail: `The variable reinforcement schedule is the most addictive pattern known to neuroscience. Each swipe is a mini-gamble. The brain can't distinguish between swiping for mates and pulling a slot machine lever.`,
    stat: `Worse: the constant novelty prevents the brain from ever settling into the calmer oxytocin-vasopressin bonding system. You're stuck in dopaminergic seeking mode, never reaching attachment mode.`,
    solution: [
      'Remove variable rewards — No random matches, no surprise notifications',
      'Build toward oxytocin — Design for depth over novelty',
      'Time-gate the experience — Prevent binge-swiping; the brain needs rest to process',
    ],
  },
  {
    id: 'psych',
    name: 'Dr. Psych',
    title: 'Clinical Psychologist',
    color: '#60a5fa', // blue
    avatar: '🛋️',
    problem: `I'm seeing an epidemic of dating app burnout in my practice. 79% of Gen Z reports it. The psychological damage is real and measurable.`,
    detail: `Commodification of self — People start seeing themselves as products to be marketed. Rejection sensitivity — Thousands of micro-rejections erode self-worth. Paradox of choice — More options equals less satisfaction.`,
    stat: `Research shows people choosing from 24 profiles are LESS satisfied than those choosing from 6. We've created the opposite of what humans need.`,
    solution: [
      'Reduce choice — Decision paralysis is real',
      'Encourage investment — What we invest in, we value more',
      'Create psychological safety — People need to feel safe to be authentic',
    ],
  },
  {
    id: 'shrink',
    name: 'Dr. Shrink',
    title: 'Psychiatrist',
    color: '#c084fc', // purple
    avatar: '💊',
    problem: `From a psychiatric perspective, dating apps are triggering and maintaining anxiety and depression at clinical levels.`,
    detail: `Social comparison on steroids—everyone's highlight reel. Intermittent reinforcement creating compulsive checking behaviors. Rejection loops that mirror and reinforce existing depression.`,
    stat: `The 10 hours/week average for 18-30 year olds correlates with higher loneliness and anxiety. These apps are making people mentally unwell.`,
    solution: [
      'Built-in breaks — Prevent compulsive use patterns',
      'Explicit rejection over ghosting — Research shows ghosting causes MORE psychological harm',
      'Safety infrastructure — Reduce anxiety through verification, check-ins, emergency features',
    ],
  },
  {
    id: 'econ',
    name: 'Prof. Econ',
    title: 'Behavioral Economist',
    color: '#fbbf24', // amber
    avatar: '📊',
    problem: `The market is broken by design. Dating apps are a textbook case of misaligned incentives.`,
    detail: `The apps profit from engagement, not from successful matching. If everyone found partners quickly, revenue would collapse. Match Group's business model is literally "engineered to prevent users from finding love" — per the class-action lawsuit.`,
    stat: `The gender ratio (67% men / 33% women) creates a dysfunctional marketplace. Men face scarcity, respond with low-effort mass-swiping, which creates volume overload for women, who respond with hyper-selectivity. It's a death spiral.`,
    solution: [
      'Align business model with user success — Subscription that ends when you match successfully',
      "Two-sided marketplace balance — Can't have 67/33 gender split",
      'Quality over quantity metrics — Measure conversation depth, not swipe volume',
    ],
  },
]

function ExpertCard({ expert }: { expert: (typeof experts)[0] }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.section
      ref={ref}
      className="expert-section"
      style={{ '--expert-color': expert.color } as React.CSSProperties}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
    >
      <div className="expert-header">
        <motion.div
          className="expert-avatar"
          initial={{ scale: 0, rotate: -180 }}
          animate={isInView ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -180 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
        >
          {expert.avatar}
        </motion.div>
        <motion.div
          className="expert-info"
          initial={{ x: -50, opacity: 0 }}
          animate={isInView ? { x: 0, opacity: 1 } : { x: -50, opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h2>{expert.name}</h2>
          <p className="expert-title">{expert.title}</p>
        </motion.div>
      </div>

      <motion.blockquote
        className="expert-problem"
        initial={{ y: 30, opacity: 0 }}
        animate={isInView ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        "{expert.problem}"
      </motion.blockquote>

      <motion.p
        className="expert-detail"
        initial={{ y: 30, opacity: 0 }}
        animate={isInView ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        {expert.detail}
      </motion.p>

      <motion.div
        className="expert-stat"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.7 }}
      >
        <span className="stat-icon">⚡</span>
        {expert.stat}
      </motion.div>

      <motion.div
        className="expert-solutions"
        initial={{ y: 30, opacity: 0 }}
        animate={isInView ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <h3>The fix:</h3>
        <ul>
          {expert.solution.map((sol, i) => (
            <motion.li
              key={i}
              initial={{ x: -20, opacity: 0 }}
              animate={isInView ? { x: 0, opacity: 1 } : { x: -20, opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.9 + i * 0.1 }}
            >
              {sol}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </motion.section>
  )
}

function HeroSection() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%'])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  return (
    <motion.section ref={ref} className="hero-section" style={{ opacity }}>
      <motion.div className="hero-content" style={{ y }}>
        <motion.p
          className="hero-kicker"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          A panel of experts walk into a dating app...
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Why Dating Apps
          <br />
          <span className="gradient-text">Are Failing You</span>
        </motion.h1>
        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          Five experts. Five disciplines. One uncomfortable truth.
        </motion.p>
        <motion.div
          className="scroll-indicator"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <span>Scroll to explore</span>
          <motion.div
            className="scroll-arrow"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ↓
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.section>
  )
}

function PanelIntro() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.section ref={ref} className="panel-intro">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8 }}
      >
        The Panel
      </motion.h2>
      <div className="panel-grid">
        {experts.map((expert, i) => (
          <motion.div
            key={expert.id}
            className="panel-member"
            style={{ '--expert-color': expert.color } as React.CSSProperties}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5, delay: 0.1 * i }}
          >
            <span className="panel-avatar">{expert.avatar}</span>
            <span className="panel-name">{expert.name}</span>
            <span className="panel-title">{expert.title}</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function DebateTopic() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.section ref={ref} className="debate-topic">
      <motion.div
        className="topic-badge"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.6 }}
      >
        DEBATE TOPIC 1
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        Why Are Dating Apps Failing?
      </motion.h2>
    </motion.section>
  )
}

function Conclusion() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.section ref={ref} className="conclusion-section">
      <motion.div
        className="conclusion-content"
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
      >
        <h2>The Verdict</h2>
        <p className="verdict-text">
          Dating apps aren't broken by accident.
          <br />
          <strong>They're broken by design.</strong>
        </p>
        <p className="verdict-detail">
          Every expert arrived at the same conclusion through different lenses: the incentive
          structure rewards keeping you single, not helping you find love.
        </p>
        <motion.div
          className="cta-section"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <p className="cta-intro">That's why we built Delete differently.</p>
          <a href="/" className="cta-button">
            Join the waitlist
          </a>
        </motion.div>
      </motion.div>
    </motion.section>
  )
}

export default function ExpertDebate() {
  return (
    <div className="debate-container">
      <HeroSection />
      <PanelIntro />
      <DebateTopic />
      {experts.map((expert) => (
        <ExpertCard key={expert.id} expert={expert} />
      ))}
      <Conclusion />
    </div>
  )
}
