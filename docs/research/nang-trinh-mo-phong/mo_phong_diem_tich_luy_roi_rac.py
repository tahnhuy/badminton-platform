"""Mô phỏng Hướng A — điểm tích lũy rời rạc theo bậc (bản nháp, bị loại vì lạm phát / dao động).
Báo cáo: docs/research/bao-cao-cong-thuc-nang-trinh.md §3.1, §3.4.
Chạy: python3 -I mo_phong_diem_tich_luy_roi_rac.py
"""
SCALE=0.7
import random, statistics as st
K=20;SC=1.5
def E(d): return 1/(1+10**(d/SC))
def W(d): return K*(1-E(d))
def L(d): return -K*E(d)
BON=[10,5,0]
BONUS={1:10,2:5,4:0,8:0}  # place by "lost in round of size": champion=1, runner=2, semis=4, quarters=8
def run(seed, cfg, CHAMP=True, n_players=200, n_events=300, field=16, scale=None, EXTRA=True, EVQ=True):
    scale=scale or SCALE
    rnd=random.Random(seed)
    P=[]
    for i in range(n_players):
        true=rnd.choice([2,3,3,4,4,4,5,5,6])+rnd.uniform(-0.4,0.4)
        e=rnd.random()
        err= 0 if e<0.55 else (1 if e<0.8 else -1) if e<0.95 else (2 if e<0.975 else -2)
        lvl=max(1,min(7,round(true)+err))
        P.append(dict(true=true,lvl=lvl,tent=True,hist=[],changes=0,flips=0,last=None,n_since=0))
    for ev in range(n_events):
        c=rnd.randint(2,6); lo,hi=c-1,c+1
        pool=[p for p in P if lo<=p['lvl']<=hi]
        if len(pool)<8: continue
        n=min(field,len(pool)); n=8 if n<16 else 16
        ent=rnd.sample(pool,n)
        snap={id(p):p['lvl'] for p in ent}
        fm=st.mean(snap.values())
        res={id(p):dict(m=[],place=None) for p in ent}
        alive=ent[:]; rnd.shuffle(alive); size=n
        while len(alive)>1:
            nxt=[]
            for a,b in zip(alive[::2],alive[1::2]):
                pa=1/(1+10**(-(a['true']-b['true'])/scale))
                w,l=(a,b) if rnd.random()<pa else (b,a)
                res[id(w)]['m'].append((snap[id(l)],1)); res[id(l)]['m'].append((snap[id(w)],0))
                res[id(l)]['place']=size; nxt.append(w)
            alive=nxt; size//=2
        res[id(alive[0])]['place']=1
        for p in ent:
            r=snap[id(p)]; R=res[id(p)]
            mp=sum(W(o-r) if w else L(o-r) for o,w in R['m'])
            S=min(1,n/8); F=max(0.5,min(1.5,1+0.5*(fm-r)))
            b=BONUS.get(R['place'],0)*S*F
            p['hist'].append(dict(T=mp+b,top4=R['place']<=4,winEq=any(w and o>=r for o,w in R['m']),lossLow=sum(1 for o,w in R['m'] if not w and o<=r-1),champAll=R['place']==1 and min(snap.values())>=r and n>=8))
            p['n_since']+=1
            H=p['hist']; tot=sum(h['T'] for h in H); k=len(H)
            up,dn,nu,nd=(cfg['tu'],cfg['td'],1,2) if p['tent'] else (cfg['cu'],cfg['cd'],2,3)
            new=None
            if p['lvl']<7 and ((CHAMP and H[-1]['champAll']) or (tot>=up and k>=nu and (not EVQ or any(h['winEq'] for h in H)))): new=p['lvl']+1
            elif p['lvl']>1 and tot<=dn and k>=nd and (not EXTRA or (sum(h['lossLow'] for h in H)>=(1 if p['tent'] else 2) and not any(h['top4'] for h in H))): new=p['lvl']-1
            if new:
                if p['last'] is not None and (new-p['lvl'])!=p['last']: p['flips']+=1
                p['last']=new-p['lvl']; p['lvl']=new; p['tent']=False; p['hist']=[]; p['changes']+=1
            elif p['tent'] and k>=2: p['tent']=False
    acc=st.mean(1 if p['lvl']==round(p['true']) else 0 for p in P)
    bias=st.mean(p['lvl']-p['true'] for p in P)
    acc0=None
    mae=st.mean(abs(p['lvl']-p['true']) for p in P)
    flips=st.mean(p['flips'] for p in P); ch=st.mean(p['changes'] for p in P)
    return acc,mae,flips,ch,bias
def init_acc(seed):
    rnd=random.Random(seed); c=0
    for i in range(200):
        true=rnd.choice([2,3,3,4,4,4,5,5,6])+rnd.uniform(-0.4,0.4); e=rnd.random()
        err= 0 if e<0.55 else (1 if e<0.8 else -1) if e<0.95 else (2 if e<0.975 else -2)
        c+= max(1,min(7,round(true)+err))==round(true)
    return c/200



for sc in (0.7,1.5):
  SCALE=sc
  for EX,EV in ((True,True),(False,True),(False,False)):
    for cu,cd,tu,td in [(50,-50,25,-25),(60,-60,30,-30),(40,-40,20,-20)]:
      cfg=dict(tu=tu,td=td,cu=cu,cd=cd)
      rs=[run(s,cfg,False,EXTRA=EX,EVQ=EV) for s in range(12)]
      print('scale',sc,'extraDemote',EX,'winEq',EV,cfg,'acc=%.3f mae=%.3f flips=%.3f ch=%.2f bias=%+.2f'%tuple(st.mean(x[i] for x in rs) for i in range(5)))
