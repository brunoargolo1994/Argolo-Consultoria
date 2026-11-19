/**
 * Argolo Consultoria e Tecnologia
 * Main JavaScript: Interactivity, Canvas Animation, Smooth Scroll & Form Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initParticleCanvas();
  initNavigation();
  initScrollAnimations();
  initContactForm();
  initCurrentYear();
});

/* ==========================================================================
   1. Interactive Cyber Particle Canvas
   ========================================================================== */
function initParticleCanvas() {
  const canvas = document.getElementById('tech-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  let particles = [];
  const particleCount = Math.min(Math.floor(width / 22), 65);
  const maxDistance = 140;

  const mouse = {
    x: null,
    y: null,
    radius: 120
  };

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createParticles();
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.x;
    mouse.y = e.y;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.7;
      this.vy = (Math.random() - 0.5) * 0.7;
      this.radius = Math.random() * 2 + 1;
      this.baseAlpha = Math.random() * 0.5 + 0.2;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      // Mouse interaction
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const directionX = (dx / dist) * force * 1.5;
          const directionY = (dy / dist) * force * 1.5;
          this.x -= directionX;
          this.y -= directionY;
        }
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 210, 255, ${this.baseAlpha})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(0, 210, 255, 0.8)';
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }

  createParticles();

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();

      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDistance) {
          const alpha = (1 - dist / maxDistance) * 0.22;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0, 210, 255, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();
}

/* ==========================================================================
   2. Navigation, Sticky Header & Scrollspy
   ========================================================================== */
function initNavigation() {
  const header = document.querySelector('.site-header');
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  // Sticky header on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Scrollspy active link
    let currentSection = '';
    const scrollPosition = window.pageYOffset + 150;

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        currentSection = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentSection}`) {
        link.classList.add('active');
      }
    });
  });

  // Mobile Menu Toggle
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      mobileToggle.classList.toggle('active');
      mobileToggle.setAttribute('aria-expanded', isOpen);
    });

    // Close mobile menu when a nav link is clicked
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        mobileToggle.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', false);
      });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target) && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        mobileToggle.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', false);
      }
    });
  }
}

/* ==========================================================================
   3. Reveal on Scroll Animations
   ========================================================================== */
function initScrollAnimations() {
  const revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            // Unobserve after animating once
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    revealElements.forEach((el) => observer.observe(el));
  } else {
    // Fallback for browsers without IntersectionObserver
    revealElements.forEach((el) => el.classList.add('active'));
  }
}

/* ==========================================================================
   4. Contact Form Submission & WhatsApp Direct Routing
   ========================================================================== */
function initContactForm() {
  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');
  if (!contactForm) return;

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('telefone').value.trim();
    const service = document.getElementById('servico').value;
    const message = document.getElementById('mensagem').value.trim();

    if (!name || !email || !message) {
      showStatus('Por favor, preencha todos os campos obrigatórios (*).', 'error');
      return;
    }

    // Submit button state
    const submitBtn = contactForm.querySelector('.btn-submit');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" />
      </svg>
      Processando...
    `;

    // Format WhatsApp message text
    const cleanPhone = '5511966398871';
    let waMessage = `*Novo Contato via Site - Argolo Consultoria e Tecnologia*\n\n`;
    waMessage += `👤 *Nome:* ${name}\n`;
    waMessage += `✉️ *E-mail:* ${email}\n`;
    if (phone) waMessage += `📱 *Telefone/WhatsApp:* ${phone}\n`;
    waMessage += `💼 *Serviço de Interesse:* ${service}\n`;
    waMessage += `📝 *Mensagem:* ${message}\n`;

    const encodedMessage = encodeURIComponent(waMessage);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    // Attempt background save via API (if hosted with Flask), then route to WhatsApp
    const payload = { nome: name, email, telefone: phone, servico: service, mensagem: message };

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {
      // Ignora erro se for executado como arquivo estático local sem servidor Flask
    }).finally(() => {
      showStatus('Obrigado! Sua mensagem foi processada. Abrindo o WhatsApp para atendimento imediato...', 'success');
      submitBtn.innerHTML = originalBtnHtml;
      submitBtn.disabled = false;
      contactForm.reset();

      // Open WhatsApp in new tab after 1 second for seamless UX
      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, 1000);
    });
  });

  function showStatus(text, type) {
    if (!formStatus) return;
    formStatus.className = `form-status ${type}`;
    formStatus.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${type === 'success' ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
      </svg>
      <span>${text}</span>
    `;
    formStatus.style.display = 'flex';
  }
}

/* ==========================================================================
   5. Current Year
   ========================================================================== */
function initCurrentYear() {
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}
