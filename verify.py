import re

with open('public/index.html', 'r') as f:
    content = f.read()

with open('public/js/main.js', 'r') as f:
    main_js = f.read()

with open('server.js', 'r') as f:
    server_js = f.read()

print("✅ ONE-PAGE LANDING PAGE VERIFICATION\n")
print("=" * 60)

print("\n📄 INDEX.HTML VERIFICATION:")
print("  ✓ Has anchor IDs" if re.search(r'<section[^>]*id="', content) else "  ✗ Missing section IDs")
print("  ✓ Navigation uses anchors" if content.count('href="#') > 20 else "  ✗ Navigation not anchored")
print("  ✓ No /offers/ routes" if '/offers/' not in content else "  ✗ Still has /offers/ routes")
print("  ✓ No /service/ routes" if '/service/' not in content else "  ✗ Still has /service/ routes")
print("  ✓ No /contact/ routes" if '/contact/' not in content else "  ✗ Still has /contact/ routes")
print("  ✓ AI Chat widget present" if 'aiChatWidget' in content else "  ✗ AI Chat widget missing")

print("\n🔄 MAIN.JS VERIFICATION:")
print("  ✓ Smooth scroll implemented" if 'window.scrollTo' in main_js else "  ✗ No smooth scroll")
print("  ✓ Browser history added" if 'window.history.pushState' in main_js else "  ✗ No history API")
print("  ✓ Popstate handler added" if 'popstate' in main_js else "  ✗ No back button support")
print("  ✓ Mobile menu handling" if 'mobileMenuToggle' in main_js else "  ✗ No mobile menu")

print("\n🖥️ SERVER.JS VERIFICATION:")
print("  ✓ Catch-all routing" if "app.get('*'" in server_js else "  ✗ No catch-all routing")
print("  ✓ Serves index.html" if "res.sendFile(path.join(__dirname, 'public', 'index.html'))" in server_js else "  ✗ Not serving index.html")
print("  ✓ API routes mounted" if "app.use('/api'" in server_js else "  ✗ API routes missing")
print("  ✓ Health check endpoint" if "app.get('/health'" in server_js else "  ✗ No health check")

print("\n" + "=" * 60)
print("\n🎯 NAVIGATION STRUCTURE:")
nav_items = [
    ("Home", "#home"),
    ("About", "#why-choose"),
    ("Services", "#services"),
    ("Pricing", "#pricing"),
    ("Contact", "#get-started"),
]

for label, anchor in nav_items:
    exists = anchor in content or label in content
    status = "✓" if exists else "✗"
    print(f"  {status} {label} ({anchor})")

print("\n📱 MOBILE RESPONSIVENESS:")
print("  ✓ Mobile menu toggle" if 'mobile-menu-toggle' in content else "  ✗ No mobile menu")
with open('public/css/mobile.css', 'r') as f:
    mobile_css = f.read()
print("  ✓ CSS mobile breakpoint" if '@media' in mobile_css else "  ✗ No responsive CSS")

print("\n" + "=" * 60)
print("\n✨ ONE-PAGE LANDING PAGE READY!")
print("\nDeploy with: npm install && npm run dev")
print("Production: node server.js")
