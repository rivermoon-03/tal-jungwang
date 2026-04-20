The code below contains a design. This design should be used to create a new app or be added to an existing one.

Look at the current open project to determine if a project exists. If no project is open, create a new Vite project then create this view in React after componentizing it.

If a project does exist, determine the framework being used and implement the design within that framework. Identify whether reusable components already exist that can be used to implement the design faithfully and if so use them, otherwise create new components. If other views already exist in the project, make sure to place the view in a sensible route and connect it to the other views.

Ensure the visual characteristics, layout, and interactions in the design are preserved with perfect fidelity.

Run the dev command so the user can see the app once finished.

```
<html lang="ko" vid="0"><head vid="1">
    <meta charset="UTF-8" vid="2">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" vid="3">
    <title vid="4">Minimal Transit UI</title>
    <script src="https://cdn.tailwindcss.com/3.4.17" vid="5"></script>
    <script src="https://unpkg.com/lucide@latest" vid="6"></script>
    <link href="https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/static/woff2/SUIT.css" rel="stylesheet" vid="7">
    <style vid="8">
        :root {
            --bg-dark: #0a0a0c;
            --surface: #121216;
            --surface-elevated: #1a1a20;
            --text-primary: #f4f4f5;
            --text-secondary: #a1a1aa;
            --text-tertiary: #52525b;
            --accent-green: #34d399;
            --accent-orange: #fb923c;
            --accent-red: #f87171;
            --accent-blue: #60a5fa;
        }

        body {
            font-family: 'SUIT', sans-serif;
            background-color: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        
        .no-scrollbar {
            -ms-overflow-style: none;  
            scrollbar-width: none;  
        }

        
        .noise-bg {
            position: relative;
        }
        .noise-bg::before {
            content: "";
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E");
            pointer-events: none;
            z-index: 50;
            opacity: 0.8;
        }

        .glass-panel {
            background: rgba(26, 26, 32, 0.4);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .soft-shadow {
            box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.5);
        }

        .breathe-dot {
            animation: pulse-soft 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse-soft {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
        }
    </style>
</head>
<body class="w-full h-full" vid="9">

    
    <div class="w-[390px] h-[844px] bg-[#0a0a0c] relative overflow-hidden rounded-[40px] shadow-2xl ring-1 ring-white/10 flex flex-col text-zinc-100 noise-bg" vid="10">
        
        
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" vid="11"></div>

        
        <main class="flex-1 overflow-y-auto no-scrollbar relative z-10 pb-32" vid="12">
            
            
            <header class="px-6 pt-14 pb-6 flex justify-between items-start" vid="13">
                <div vid="14">
                    <h1 class="text-[44px] font-bold tracking-tighter leading-none text-zinc-100" vid="15">08:42</h1>
                    <p class="text-[11px] font-medium text-zinc-500 mt-2 uppercase tracking-[0.15em]" vid="16">Wed, Oct 25</p>
                </div>
                <div class="flex flex-col items-end gap-1.5 pt-2 text-zinc-400" vid="17">
                    <i data-lucide="cloud" class="w-5 h-5 stroke-[2]" vid="18"></i>
                    <span class="text-[12px] font-bold tracking-widest" vid="19">12°</span>
                </div>
            </header>

            
            <section class="px-6 mb-8" vid="20">
                <div class="bg-[#121216] rounded-full p-1.5 flex ring-1 ring-white/5 shadow-inner" vid="21">
                    <button class="flex-1 py-3 text-[13px] text-zinc-500 font-medium rounded-full transition-all hover:text-zinc-300" vid="22">
                        등교 <span class="text-xs opacity-40 ml-1 font-normal" vid="23">To</span>
                    </button>
                    <button class="flex-1 py-3 text-[#0a0a0c] bg-zinc-100 font-bold rounded-full shadow-sm flex items-center justify-center gap-1.5 transition-all" vid="24">
                        하교 <span class="text-xs opacity-40 ml-0.5 font-normal" vid="25">From</span>
                        <span class="bg-[#3b82f6] text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ml-0.5" vid="26">Auto</span>
                    </button>
                </div>
            </section>

            
            <section class="mb-6" vid="27">
                <div class="flex px-6 gap-8 overflow-x-auto no-scrollbar" vid="28">
                    <button class="flex flex-col items-center gap-2 shrink-0" vid="29">
                        <span class="text-[15px] font-bold text-zinc-100 tracking-wide" vid="30">정왕역</span>
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" vid="31"></div>
                    </button>
                    <button class="flex flex-col items-center gap-2 shrink-0 group" vid="32">
                        <span class="text-[15px] font-semibold text-zinc-600 group-hover:text-zinc-400 transition-colors tracking-wide" vid="33">사당</span>
                        <div class="w-1.5 h-1.5 rounded-full bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity" vid="34"></div>
                    </button>
                    <button class="flex flex-col items-center gap-2 shrink-0 group" vid="35">
                        <span class="text-[15px] font-semibold text-zinc-600 group-hover:text-zinc-400 transition-colors tracking-wide" vid="36">강남</span>
                        <div class="w-1.5 h-1.5 rounded-full bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity" vid="37"></div>
                    </button>
                </div>
            </section>

            
            <section class="px-6 mb-10" vid="38">
                <div class="relative bg-gradient-to-br from-[#1a1a22] to-[#121216] rounded-[32px] p-7 border border-white/[0.04] soft-shadow overflow-hidden group" vid="39">
                    
                    <div class="absolute -top-10 -right-10 w-40 h-40 bg-[#3b82f6]/10 rounded-full blur-3xl group-hover:bg-[#3b82f6]/20 transition-all duration-700" vid="40"></div>
                    
                    <div class="flex justify-between items-start relative z-10 mb-8" vid="41">
                        <div class="flex items-center gap-3" vid="42">
                            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ring-1 ring-white/5" vid="43">
                                <i data-lucide="bus-front" class="w-5 h-5 text-blue-400" vid="44"></i>
                            </div>
                            <span class="text-sm font-bold text-zinc-200 tracking-wide" vid="45">학교 셔틀</span>
                        </div>
                        <div class="px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 flex items-center gap-2" vid="46">
                            <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full breathe-dot shadow-[0_0_8px_rgba(52,211,153,0.4)]" vid="47"></span>
                            <span class="text-[10px] text-emerald-400 font-bold tracking-wide uppercase" vid="48">Comfortable</span>
                        </div>
                    </div>

                    <div class="relative z-10" vid="49">
                        <div class="flex items-baseline gap-2 mb-2" vid="50">
                            <span class="text-[104px] font-bold leading-none text-white tracking-tighter" style="font-feature-settings: 'tnum';" vid="51">4</span>
                            <span class="text-2xl font-bold text-zinc-600" vid="52">min</span>
                        </div>
                        <div class="flex flex-col gap-2 mt-4" vid="53">
                            <p class="text-[14px] text-zinc-300 font-medium flex items-center gap-2" vid="54">
                                <i data-lucide="arrow-right" class="w-4 h-4 text-blue-400/70" vid="55"></i> Towards Jeongwang Stn.
                            </p>
                            <p class="text-[12px] text-zinc-500 flex items-center gap-2" vid="56">
                                <i data-lucide="footprints" class="w-3.5 h-3.5" vid="57"></i> 2 min walk to Station A
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            
            <section class="mb-10" vid="58">
                <div class="flex items-center justify-between px-6 mb-4" vid="59">
                    <h3 class="text-[11px] font-bold text-zinc-600 uppercase tracking-[0.2em]" vid="60">Alternatives</h3>
                </div>
                
                <div class="flex overflow-x-auto no-scrollbar px-6 gap-4 pb-4" vid="61">
                    
                    
                    <div class="shrink-0 w-[140px] p-5 rounded-[28px] bg-[#121216] border border-white/[0.03] flex flex-col justify-between aspect-[4/5]" vid="62">
                        <div class="flex justify-between items-start" vid="63">
                            <span class="text-[11px] font-bold text-zinc-400 tracking-wide" vid="64">BUS 28</span>
                            <div class="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]" vid="65"></div>
                        </div>
                        <div class="flex items-baseline gap-1 mt-auto" vid="66">
                            <span class="text-4xl font-bold text-zinc-200 tracking-tight" vid="67">9</span>
                            <span class="text-sm text-zinc-600 font-bold" vid="68">m</span>
                        </div>
                    </div>

                    
                    <div class="shrink-0 w-[140px] p-5 rounded-[28px] bg-[#121216] border border-white/[0.03] flex flex-col justify-between aspect-[4/5]" vid="69">
                        <div class="flex justify-between items-start" vid="70">
                            <span class="text-[11px] font-bold text-zinc-400 tracking-wide" vid="71">BUS 29</span>
                            <div class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" vid="72"></div>
                        </div>
                        <div class="flex items-baseline gap-1 mt-auto" vid="73">
                            <span class="text-4xl font-bold text-zinc-200 tracking-tight" vid="74">12</span>
                            <span class="text-sm text-zinc-600 font-bold" vid="75">m</span>
                        </div>
                    </div>

                    
                    <div class="shrink-0 w-[140px] p-5 rounded-[28px] bg-[#121216] border border-white/[0.03] flex flex-col justify-between aspect-[4/5]" vid="76">
                        <div class="flex justify-between items-start" vid="77">
                            <span class="text-[11px] font-bold text-zinc-400 tracking-wide" vid="78">SUBWAY 4</span>
                            <div class="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]" vid="79"></div>
                        </div>
                        <div class="flex items-baseline gap-1 mt-auto" vid="80">
                            <span class="text-4xl font-bold text-zinc-200 tracking-tight" vid="81">18</span>
                            <span class="text-sm text-zinc-600 font-bold" vid="82">m</span>
                        </div>
                    </div>

                </div>
            </section>

            
            <section class="px-6" vid="83">
                <h3 class="text-[11px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-5" vid="84">All Departures</h3>
                
                <div class="flex flex-col gap-2" vid="85">
                    
                    
                    <div class="flex items-center justify-between p-4 rounded-[24px] bg-[#121216]/50 border border-white/[0.02] group cursor-pointer hover:bg-[#1a1a22]/50 transition-colors" vid="86">
                        <div class="flex items-center gap-4" vid="87">
                            <div class="w-12 h-12 rounded-full bg-[#1a1a22] flex items-center justify-center ring-1 ring-white/5" vid="88">
                                <i data-lucide="bus-front" class="w-5 h-5 text-blue-400" vid="89"></i>
                            </div>
                            <div class="flex flex-col gap-1" vid="90">
                                <p class="text-[15px] font-bold text-zinc-200 tracking-wide" vid="91">Shuttle B</p>
                                <p class="text-[11px] font-medium text-zinc-500 tracking-wide" vid="92">Campus → Jeongwang</p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1.5" vid="93">
                            <div class="flex items-baseline gap-0.5" vid="94">
                                <p class="text-xl font-bold text-zinc-200" vid="95">14</p>
                                <p class="text-[11px] font-bold text-zinc-600" vid="96">m</p>
                            </div>
                            <div class="flex items-center gap-1.5" vid="97">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" vid="98"></span>
                                <p class="text-[9px] text-emerald-400 uppercase tracking-widest font-bold" vid="99">Comfortable</p>
                            </div>
                        </div>
                    </div>

                    
                    <div class="flex items-center justify-between p-4 rounded-[24px] bg-[#121216]/50 border border-white/[0.02] group cursor-pointer hover:bg-[#1a1a22]/50 transition-colors" vid="100">
                        <div class="flex items-center gap-4" vid="101">
                            <div class="w-12 h-12 rounded-full bg-[#1a1a22] flex items-center justify-center ring-1 ring-white/5" vid="102">
                                <i data-lucide="bus" class="w-5 h-5 text-orange-400" vid="103"></i>
                            </div>
                            <div class="flex flex-col gap-1" vid="104">
                                <p class="text-[15px] font-bold text-zinc-200 tracking-wide" vid="105">Bus 3400</p>
                                <p class="text-[11px] font-medium text-zinc-500 tracking-wide" vid="106">Campus → Gangnam</p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1.5" vid="107">
                            <div class="flex items-baseline gap-0.5" vid="108">
                                <p class="text-xl font-bold text-zinc-200" vid="109">22</p>
                                <p class="text-[11px] font-bold text-zinc-600" vid="110">m</p>
                            </div>
                            <div class="flex items-center gap-1.5" vid="111">
                                <span class="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.5)]" vid="112"></span>
                                <p class="text-[9px] text-orange-400 uppercase tracking-widest font-bold" vid="113">Tight</p>
                            </div>
                        </div>
                    </div>

                    
                    <div class="flex items-center justify-between p-4 rounded-[24px] group cursor-pointer opacity-70 hover:opacity-100 transition-opacity" vid="114">
                        <div class="flex items-center gap-4" vid="115">
                            <div class="w-12 h-12 rounded-full bg-[#16161c] flex items-center justify-center ring-1 ring-white/5" vid="116">
                                <i data-lucide="bus" class="w-5 h-5 text-zinc-500" vid="117"></i>
                            </div>
                            <div class="flex flex-col gap-1" vid="118">
                                <p class="text-[15px] font-bold text-zinc-200 tracking-wide" vid="119">Bus 62</p>
                                <p class="text-[11px] font-medium text-zinc-500 tracking-wide" vid="120">Campus → Sadang</p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1.5" vid="121">
                            <div class="flex items-baseline gap-0.5" vid="122">
                                <p class="text-xl font-bold text-zinc-200" vid="123">45</p>
                                <p class="text-[11px] font-bold text-zinc-600" vid="124">m</p>
                            </div>
                            <div class="flex items-center gap-1.5" vid="125">
                                <span class="w-1.5 h-1.5 rounded-full bg-zinc-500" vid="126"></span>
                                <p class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold" vid="127">Scheduled</p>
                            </div>
                        </div>
                    </div>

                </div>
            </section>

        </main>

        
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-auto" vid="128">
            <nav class="glass-panel rounded-full p-2.5 flex justify-between items-center gap-2 soft-shadow" vid="129">
                
                
                <button class="flex items-center gap-2.5 px-6 py-3.5 bg-white/10 rounded-full transition-transform hover:bg-white/15 active:scale-95 group" vid="130">
                    <i data-lucide="zap" class="w-5 h-5 text-zinc-100 fill-zinc-100" vid="131"></i>
                </button>
                
                
                <button class="flex items-center justify-center px-6 py-3.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-full transition-all active:scale-95" vid="132">
                    <i data-lucide="map" class="w-5 h-5 stroke-[2]" vid="133"></i>
                </button>
                
                <button class="flex items-center justify-center px-6 py-3.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-full transition-all active:scale-95" vid="134">
                    <i data-lucide="calendar-days" class="w-5 h-5 stroke-[2]" vid="135"></i>
                </button>
                
                <button class="flex items-center justify-center px-6 py-3.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-full transition-all active:scale-95" vid="136">
                    <i data-lucide="more-horizontal" class="w-5 h-5 stroke-[2]" vid="137"></i>
                </button>
            </nav>
        </div>

    </div>

    <script vid="138">
        
        lucide.createIcons();
    </script>


</body></html>
```
