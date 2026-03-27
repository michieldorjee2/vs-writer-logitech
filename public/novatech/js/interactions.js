// ===== Interactive Elements =====

// ===== Hero Canvas — Particle Grid Background =====
// Inspired by Museum of Money's interactive canvas background
function initParticleGrid() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let mouseX = 0, mouseY = 0;
  let particles = [];
  const PARTICLE_COUNT = 80;
  const CONNECTION_DISTANCE = 120;
  const MOUSE_RADIUS = 200;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 0.5,
      });
    }
  }

  function drawParticles() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p, i) => {
      // Move
      p.x += p.vx;
      p.y += p.vy;

      // Bounce off edges
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      // Mouse repulsion
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS) {
        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
        p.x += dx * force * 0.02;
        p.y += dy * force * 0.02;
      }

      // Draw particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(99, 102, 241, ${0.3 + p.radius * 0.15})`;
      ctx.fill();

      // Draw connections
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const cdx = p.x - p2.x;
        const cdy = p.y - p2.y;
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

        if (cdist < CONNECTION_DISTANCE) {
          const alpha = (1 - cdist / CONNECTION_DISTANCE) * 0.15;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    });

    requestAnimationFrame(drawParticles);
  }

  resize();
  createParticles();
  drawParticles();

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
}

// ===== Comparison Tab Switching =====
function initComparisonTabs() {
  const tabs = document.querySelectorAll('.comparison__tab');
  const groups = document.querySelectorAll('.comparison__group');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const product = tab.getAttribute('data-product');

      // Update active tab
      tabs.forEach((t) => t.classList.remove('comparison__tab--active'));
      tab.classList.add('comparison__tab--active');

      // Show/hide groups
      groups.forEach((group) => {
        const groupProduct = group.getAttribute('data-product-group');
        if (groupProduct === product) {
          group.classList.remove('comparison__group--hidden');
          // Animate rows in
          const rows = group.querySelectorAll('.comparison__row');
          gsap.fromTo(rows,
            { opacity: 0, x: -20 },
            {
              opacity: 1,
              x: 0,
              duration: 0.4,
              stagger: 0.06,
              ease: 'power2.out',
            }
          );
        } else {
          group.classList.add('comparison__group--hidden');
        }
      });
    });
  });
}

// ===== Highlight comparison rows on hover =====
function initComparisonHover() {
  const rows = document.querySelectorAll('.comparison__row');
  rows.forEach((row) => {
    row.addEventListener('mouseenter', () => {
      // Highlight the optimizely column cell
      const optiCell = row.querySelector('.comparison__rating--full');
      if (optiCell) {
        gsap.to(optiCell, { scale: 1.02, duration: 0.2, ease: 'power2.out' });
      }
    });
    row.addEventListener('mouseleave', () => {
      const optiCell = row.querySelector('.comparison__rating--full');
      if (optiCell) {
        gsap.to(optiCell, { scale: 1, duration: 0.2, ease: 'power2.out' });
      }
    });
  });
}

// ===== Pain Point Number Glow on Scroll =====
function initPainPointEffects() {
  const pains = document.querySelectorAll('.challenge__pain');
  pains.forEach((pain) => {
    const number = pain.querySelector('.challenge__pain-number');
    ScrollTrigger.create({
      trigger: pain,
      start: 'top 70%',
      end: 'bottom 30%',
      onEnter: () => {
        gsap.to(number, { opacity: 1, color: '#6366f1', duration: 0.5 });
      },
      onLeave: () => {
        gsap.to(number, { opacity: 0.4, color: '#5a5a70', duration: 0.5 });
      },
      onEnterBack: () => {
        gsap.to(number, { opacity: 1, color: '#6366f1', duration: 0.5 });
      },
      onLeaveBack: () => {
        gsap.to(number, { opacity: 0.4, color: '#5a5a70', duration: 0.5 });
      },
    });
  });
}

// ===== Initialize All Interactions =====
document.addEventListener('DOMContentLoaded', () => {
  // Particle grid removed — hero-3d.js now owns the canvas
  initComparisonTabs();
  initComparisonHover();
  initPainPointEffects();
});
