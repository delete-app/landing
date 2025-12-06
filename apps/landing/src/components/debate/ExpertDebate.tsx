'use client'

import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import { useRef, useState } from 'react'

// Expert data - playful fictional names from the strategy doc
const experts = [
  {
    id: 'evo',
    name: 'Dr. Evo',
    field: 'Evolutionary Biologist',
    icon: '🧬',
    color: '#22c55e',
    bgGradient: 'linear-gradient(135deg, #052e16 0%, #0a0a0a 50%, #0a0a0a 100%)',
    problem: `Dating apps created an evolutionarily novel environment. Humans evolved evaluating 50-100 partners in a lifetime. Now you see 50 in 10 minutes.`,
    insight: `Women's evolved selectivity gets amplified—they swipe right on only 5%. Men mass-swipe on 46%. Both strategies become dysfunctional at scale.`,
    stat: { value: '80%', label: 'of men rated "below average" by women on apps' },
    quote: `That's not biology. That's contrast effect from too many options too fast.`,
  },
  {
    id: 'neuro',
    name: 'Dr. Neuro',
    field: 'Neurobiologist',
    icon: '🧠',
    color: '#ec4899',
    bgGradient: 'linear-gradient(135deg, #500724 0%, #0a0a0a 50%, #0a0a0a 100%)',
    problem: `These apps are literally hijacking the dopamine system. Dopamine rises twice as much anticipating a match than actually getting one.`,
    insight: `Variable reinforcement—the same mechanism as slot machines. Each swipe is a mini-gamble. The brain can't tell the difference.`,
    stat: { value: '2×', label: 'more dopamine from anticipation than reward' },
    quote: `You're stuck in dopaminergic seeking mode. You never reach attachment mode.`,
  },
  {
    id: 'psych',
    name: 'Dr. Psych',
    field: 'Clinical Psychologist',
    icon: '🛋️',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #172554 0%, #0a0a0a 50%, #0a0a0a 100%)',
    problem: `I'm seeing an epidemic of dating app burnout in my practice. 79% of Gen Z reports it. The psychological damage is real.`,
    insight: `Commodification of self. Thousands of micro-rejections eroding self-worth. And the paradox of choice—more options, less satisfaction.`,
    stat: { value: '79%', label: 'of Gen Z report dating app burnout' },
    quote: `People choosing from 24 profiles are LESS satisfied than those choosing from 6.`,
  },
  {
    id: 'shrink',
    name: 'Dr. Shrink',
    field: 'Psychiatrist',
    icon: '💊',
    color: '#a855f7',
    bgGradient: 'linear-gradient(135deg, #3b0764 0%, #0a0a0a 50%, #0a0a0a 100%)',
    problem: `Dating apps are triggering and maintaining anxiety and depression at clinical levels.`,
    insight: `Social comparison on steroids. Intermittent reinforcement creating compulsive checking. Rejection loops that reinforce depression.`,
    stat: { value: '10h', label: 'average weekly use for 18-30 year olds' },
    quote: `These apps are making people mentally unwell.`,
  },
  {
    id: 'econ',
    name: 'Prof. Econ',
    field: 'Behavioral Economist',
    icon: '📊',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #451a03 0%, #0a0a0a 50%, #0a0a0a 100%)',
    problem: `The market is broken by design. A textbook case of misaligned incentives.`,
    insight: `Apps profit from engagement, not successful matching. If everyone found partners quickly, revenue collapses.`,
    stat: { value: '67%', label: 'of users are men—a death spiral marketplace' },
    quote: `"Engineered to prevent users from finding love" — per the class-action lawsuit.`,
  },
]

function HeroSection() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '40%'])
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.6], [1, 0.95])

  return (
    <motion.section ref={ref} className="hero-section" style={{ opacity }}>
      <motion.div className="hero-content" style={{ y, scale }}>
        <motion.p
          className="hero-kicker"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        >
          A panel of experts walk into a dating app...
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.4 }}
        >
          <span className="hero-line">Why Dating Apps</span>
          <span className="hero-line-accent">Are Failing You</span>
        </motion.h1>
        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.6 }}
        >
          Five experts. Five disciplines. One uncomfortable truth.
        </motion.p>
      </motion.div>
      <motion.div
        className="scroll-cue"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
      >
        <motion.div
          className="scroll-line"
          animate={{ scaleY: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </motion.section>
  )
}

function PanelOverview() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-20%' })
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <motion.section ref={ref} className="panel-overview">
      <motion.div
        className="panel-header"
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      >
        <span className="panel-label">The Panel</span>
        <h2>Five perspectives on a broken system</h2>
      </motion.div>

      <div className="panel-experts">
        {experts.map((expert, i) => (
          <motion.div
            key={expert.id}
            className="panel-expert"
            initial={{ opacity: 0, y: 60 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.1 + i * 0.1 }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={
              {
                '--expert-color': expert.color,
                opacity: hoveredIndex === null || hoveredIndex === i ? 1 : 0.4,
              } as React.CSSProperties
            }
          >
            <div className="expert-icon">{expert.icon}</div>
            <div className="expert-details">
              <span className="expert-name">{expert.name}</span>
              <span className="expert-field">{expert.field}</span>
            </div>
            <motion.div
              className="expert-line"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: hoveredIndex === i ? 1 : 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            />
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function ExpertSection({ expert }: { expert: (typeof experts)[0] }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-30%' })
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const bgOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0])

  return (
    <motion.section
      ref={ref}
      className="expert-fullscreen"
      style={
        {
          '--expert-color': expert.color,
        } as React.CSSProperties
      }
    >
      <motion.div
        className="expert-bg"
        style={{
          background: expert.bgGradient,
          opacity: bgOpacity,
        }}
      />

      <div className="expert-content">
        <motion.div
          className="expert-intro"
          initial={{ opacity: 0, x: -60 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
        >
          <span className="expert-icon-large">{expert.icon}</span>
          <div className="expert-meta">
            <h2>{expert.name}</h2>
            <span className="expert-field-tag">{expert.field}</span>
          </div>
        </motion.div>

        <motion.div
          className="expert-statement"
          initial={{ opacity: 0, y: 60 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        >
          <p className="statement-problem">{expert.problem}</p>
          <p className="statement-insight">{expert.insight}</p>
        </motion.div>

        <motion.div
          className="expert-data"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.4 }}
        >
          <div className="stat-display">
            <span className="stat-value">{expert.stat.value}</span>
            <span className="stat-label">{expert.stat.label}</span>
          </div>
        </motion.div>

        <motion.blockquote
          className="expert-quote"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.6 }}
        >
          <span className="quote-mark">"</span>
          {expert.quote}
        </motion.blockquote>
      </div>
    </motion.section>
  )
}

function Verdict() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-30%' })

  return (
    <motion.section ref={ref} className="verdict-section">
      <motion.div
        className="verdict-content"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.span
          className="verdict-label"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          The Verdict
        </motion.span>

        <motion.h2
          className="verdict-headline"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, delay: 0.4 }}
        >
          <span>Dating apps aren't broken</span>
          <span className="verdict-accent">by accident.</span>
        </motion.h2>

        <motion.p
          className="verdict-subtext"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          They're broken <em>by design</em>. The incentive structure rewards keeping you single.
        </motion.p>

        <motion.div
          className="verdict-cta"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <p>That's why we built Delete differently.</p>
          <a href="/" className="cta-link">
            <span>Join the waitlist</span>
            <span className="cta-arrow">→</span>
          </a>
        </motion.div>
      </motion.div>
    </motion.section>
  )
}

export default function ExpertDebate() {
  return (
    <div className="debate-wrapper">
      <HeroSection />
      <PanelOverview />
      {experts.map((expert) => (
        <ExpertSection key={expert.id} expert={expert} />
      ))}
      <Verdict />
    </div>
  )
}
