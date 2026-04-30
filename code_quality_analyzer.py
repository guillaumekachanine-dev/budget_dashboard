#!/usr/bin/env python3
"""
Code Quality Analyzer - Analyse réelle de la qualité du code
Vérifie: complexité, imports orphelins, patterns, performance
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import Dict, List, Optional
from collections import defaultdict

class CodeQualityAnalyzer:
    """Analyse la qualité du code React/TypeScript"""
    
    def __init__(self, target_path: str, verbose: bool = False):
        self.target_path = Path(target_path)
        self.verbose = verbose
        self.results = {
            'status': 'success',
            'target': str(target_path),
            'files_analyzed': 0,
            'findings': [],
            'warnings': [],
            'suggestions': [],
            'metrics': {}
        }
    
    def run(self) -> Dict:
        """Exécute l'analyse complète"""
        print(f"🔍 Analyse du code: {self.target_path}")
        
        try:
            self.validate_target()
            self.analyze_directory()
            self.calculate_metrics()
            self.generate_report()
            
            print("✅ Analyse terminée!")
            return self.results
            
        except Exception as e:
            print(f"❌ Erreur: {e}")
            self.results['status'] = 'error'
            sys.exit(1)
    
    def validate_target(self):
        """Valide le chemin"""
        if not self.target_path.exists():
            raise ValueError(f"Chemin inexistant: {self.target_path}")
        
        if self.verbose:
            print(f"✓ Cible validée")
    
    def analyze_directory(self):
        """Analyse tous les fichiers JS/JSX/TS/TSX"""
        src_path = self.target_path / "src"
        
        if not src_path.exists():
            self.results['warnings'].append("Dossier 'src' non trouvé")
            return
        
        # Extensions à analyser
        extensions = ('.js', '.jsx', '.ts', '.tsx')
        
        for file_path in src_path.rglob('*'):
            if file_path.suffix in extensions and file_path.is_file():
                self.analyze_file(file_path)
                self.results['files_analyzed'] += 1
        
        if self.verbose:
            print(f"✓ {self.results['files_analyzed']} fichiers analysés")
    
    def analyze_file(self, file_path: Path):
        """Analyse un fichier spécifique"""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            relative_path = file_path.relative_to(self.target_path)
            
            # Différentes analyses
            self.check_complexity(content, relative_path)
            self.check_imports(content, relative_path)
            self.check_react_patterns(content, relative_path)
            self.check_typescript_usage(content, relative_path)
            self.check_console_logs(content, relative_path)
            self.check_performance(content, relative_path)
            
        except Exception as e:
            self.results['warnings'].append(f"Erreur analysant {file_path}: {e}")
    
    def check_complexity(self, content: str, file_path: Path):
        """Vérifie la complexité cyclomatique (fonctions trop longues)"""
        lines = content.split('\n')
        
        # Detect les fonctions
        function_pattern = r'(?:function|const\s+\w+\s*=\s*\(|async\s+function|async\s+\()'
        
        in_function = False
        function_length = 0
        function_name = ""
        
        for i, line in enumerate(lines):
            if re.search(r'function\s+(\w+)', line):
                match = re.search(r'function\s+(\w+)', line)
                function_name = match.group(1) if match else "anonymous"
                in_function = True
                function_length = 0
            
            if in_function:
                function_length += 1
                
                # Alerte si fonction > 50 lignes
                if function_length > 50 and '{' in line:
                    self.results['findings'].append({
                        'type': 'COMPLEXITY',
                        'file': str(file_path),
                        'line': i + 1,
                        'issue': f"Fonction '{function_name}' trop longue ({function_length} lignes)",
                        'severity': 'warning'
                    })
                    in_function = False
    
    def check_imports(self, content: str, file_path: Path):
        """Vérifie les imports (orphelins, non-utilisés)"""
        import_pattern = r'import\s+(?:{([^}]+)}|(\w+))\s+from\s+["\']([^"\']+)["\']'
        imports = re.findall(import_pattern, content)
        
        for destructured, default, source in imports:
            items = destructured.split(',') if destructured else [default]
            
            for item in items:
                item = item.strip()
                if not item:
                    continue
                
                # Vérifier si l'item est utilisé
                if not re.search(rf'\b{item}\b', content[content.find(item) + len(item):]):
                    self.results['warnings'].append({
                        'type': 'UNUSED_IMPORT',
                        'file': str(file_path),
                        'issue': f"Import non utilisé: '{item}' de {source}",
                        'severity': 'info'
                    })
    
    def check_react_patterns(self, content: str, file_path: Path):
        """Vérifie les patterns React"""
        
        # Vérifier les hooks
        hooks = ['useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo']
        
        for hook in hooks:
            if hook in content:
                # Vérifier que useEffect a une dépendance
                if hook == 'useEffect' and 'useEffect(' in content:
                    if not re.search(r'useEffect\([^)]+,\s*\[', content):
                        self.results['findings'].append({
                            'type': 'REACT_PATTERN',
                            'file': str(file_path),
                            'issue': "useEffect sans tableau de dépendances détecté",
                            'severity': 'warning'
                        })
    
    def check_typescript_usage(self, content: str, file_path: Path):
        """Vérifie l'utilisation de TypeScript"""
        if file_path.suffix in ('.ts', '.tsx'):
            # Vérifier les types explicites
            any_count = content.count(': any')
            
            if any_count > 2:
                self.results['suggestions'].append({
                    'type': 'TYPESCRIPT',
                    'file': str(file_path),
                    'issue': f"{any_count} utilisations de 'any' détectées - préférer des types explicites",
                    'severity': 'info'
                })
    
    def check_console_logs(self, content: str, file_path: Path):
        """Détecte les console.log en production"""
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            if 'console.log' in line and not line.strip().startswith('//'):
                self.results['findings'].append({
                    'type': 'DEBUG_CODE',
                    'file': str(file_path),
                    'line': i + 1,
                    'issue': "console.log détecté - à retirer avant la production",
                    'severity': 'info'
                })
    
    def check_performance(self, content: str, file_path: Path):
        """Vérifie les patterns de performance"""
        
        # Vérifier les fonctions inline dans le render
        if 'onClick={() =>' in content or 'onChange={() =>' in content:
            self.results['suggestions'].append({
                'type': 'PERFORMANCE',
                'file': str(file_path),
                'issue': "Fonction anonyme en inline - considérer useCallback",
                'severity': 'info'
            })
        
        # Vérifier les listes sans key
        if 'map(' in content and 'key=' not in content:
            self.results['suggestions'].append({
                'type': 'REACT_PATTERN',
                'file': str(file_path),
                'issue': "Utilisation de .map() sans 'key' détectée",
                'severity': 'warning'
            })
    
    def calculate_metrics(self):
        """Calcule les métriques globales"""
        self.results['metrics'] = {
            'total_findings': len(self.results['findings']),
            'total_warnings': len(self.results['warnings']),
            'total_suggestions': len(self.results['suggestions']),
            'files_analyzed': self.results['files_analyzed'],
            'quality_score': self._calculate_quality_score()
        }
    
    def _calculate_quality_score(self) -> int:
        """Calcule un score de qualité 0-100"""
        findings = len(self.results['findings'])
        warnings = len(self.results['warnings'])
        
        # Score initial
        score = 100
        score -= findings * 5  # Chaque finding: -5
        score -= warnings * 2  # Chaque warning: -2
        
        return max(0, min(100, score))
    
    def generate_report(self):
        """Génère le rapport final"""
        print("\n" + "="*70)
        print("📊 RAPPORT D'ANALYSE DE CODE")
        print("="*70)
        print(f"Cible: {self.results['target']}")
        print(f"Fichiers analysés: {self.results['files_analyzed']}")
        print(f"\n📈 Métriques:")
        print(f"  Score de qualité: {self.results['metrics']['quality_score']}/100")
        print(f"  Findings critiques: {self.results['metrics']['total_findings']}")
        print(f"  Avertissements: {self.results['metrics']['total_warnings']}")
        print(f"  Suggestions: {self.results['metrics']['total_suggestions']}")
        
        if self.results['findings']:
            print(f"\n🔴 Findings ({len(self.results['findings'])}):")
            for finding in self.results['findings'][:5]:  # Top 5
                print(f"  • {finding.get('issue')} ({finding.get('file')})")
        
        if self.results['suggestions']:
            print(f"\n💡 Suggestions ({len(self.results['suggestions'])}):")
            for suggestion in self.results['suggestions'][:3]:  # Top 3
                print(f"  • {suggestion.get('issue')}")
        
        print("="*70 + "\n")


def main():
    parser = __import__('argparse').ArgumentParser(
        description="Analyse la qualité du code"
    )
    parser.add_argument(
        'target',
        help='Chemin du projet à analyser'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Afficher les détails'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Sortie JSON'
    )
    parser.add_argument(
        '--output', '-o',
        help='Fichier de sortie'
    )
    
    args = parser.parse_args()
    
    analyzer = CodeQualityAnalyzer(
        args.target,
        args.verbose
    )
    
    results = analyzer.run()
    
    if args.json or args.output:
        output = json.dumps(results, indent=2, ensure_ascii=False)
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(output)
            print(f"✓ Résultats exportés: {args.output}")
        else:
            print(output)


if __name__ == '__main__':
    main()
