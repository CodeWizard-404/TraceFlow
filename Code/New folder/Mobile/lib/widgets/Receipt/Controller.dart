import 'package:flutter/material.dart';

class ReceiptBookController extends StatefulWidget {
  final List books;
  final Widget child;

  const ReceiptBookController({required this.books, required this.child, super.key});

  @override
  State<ReceiptBookController> createState() => _ReceiptBookControllerState();
}

class _ReceiptBookControllerState extends State<ReceiptBookController> {
  final TextEditingController _searchController = TextEditingController();
  String _sortBy = 'number';
  bool _sortAscending = true;
  Map<String, Set<String>> _filters = {'status': {}, 'type': {}};

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _getDisplayStatus(dynamic book) {
    String? stubStatus;
    if (book.receiptStub is Map) {
      stubStatus = (book.receiptStub['status'] as String?)?.toLowerCase();
    } else if (book.receiptStub != null) {
      stubStatus = (book.receiptStub.status as String?)?.toLowerCase();
    }
    if (stubStatus == "pending") return "To Agent";
    if (stubStatus == "collected") return "To Manager";
    return book.status ?? "Unknown";
  }

  List get filteredBooks {
    var filtered = widget.books.where((book) {
      final searchQuery = _searchController.text.toLowerCase();
      final displayStatus = _getDisplayStatus(book);
      final matchesSearch = (book.number ?? '').toLowerCase().contains(searchQuery) ||
          (book.type ?? '').toLowerCase().contains(searchQuery);
      final matchesStatus = _filters['status']!.isEmpty || _filters['status']!.contains(displayStatus);
      final matchesType = _filters['type']!.isEmpty || _filters['type']!.contains(book.type ?? '');
      return matchesSearch && matchesStatus && matchesType;
    }).toList();

    filtered.sort((a, b) {
      int comparison;
      switch (_sortBy) {
        case 'number':
          comparison = (a.number ?? '').compareTo(b.number ?? '');
          break;
        case 'type':
          comparison = (a.type ?? '').compareTo(b.type ?? '');
          break;
        case 'status':
          comparison = _getDisplayStatus(a).compareTo(_getDisplayStatus(b));
          break;
        default:
          comparison = 0;
      }
      return _sortAscending ? comparison : -comparison;
    });
    return filtered;
  }

  void showSortMenu(GlobalKey sortKey) {
    final theme = Theme.of(context);
    final RenderBox? button = sortKey.currentContext?.findRenderObject() as RenderBox?;
    if (button == null) return;

    final position = button.localToGlobal(Offset.zero);
    final size = button.size;

    showMenu(
      context: context,
      position: RelativeRect.fromLTRB(
        position.dx,
        position.dy + size.height,
        position.dx + size.width,
        0,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: theme.cardTheme.color,
      items: [
        _buildSortItem('Number', 'number'),
        _buildSortItem('Type', 'type'),
        _buildSortItem('Status', 'status'),
      ],
    ).then((value) {
      if (value != null) {
        setState(() {
          if (_sortBy == value) {
            _sortAscending = !_sortAscending;
          } else {
            _sortBy = value;
            _sortAscending = true;
          }
        });
      }
    });
  }

  PopupMenuItem<String> _buildSortItem(String label, String value) {
    final theme = Theme.of(context);
    return PopupMenuItem(
      value: value,
      child: Row(
        children: [
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurface,
            ),
          ),
          if (_sortBy == value) ...[
            const SizedBox(width: 8),
            Icon(
              _sortAscending ? Icons.arrow_upward : Icons.arrow_downward,
              size: 16,
              color: theme.colorScheme.primary,
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ReceiptBookScope(
      controller: this,
      child: widget.child,
    );
  }
}

class ReceiptBookScope extends InheritedWidget {
  final _ReceiptBookControllerState controller;

  const ReceiptBookScope({required this.controller, required super.child, super.key});

  TextEditingController get searchController => controller._searchController;
  Map<String, Set<String>> get filters => controller._filters;
  void setFilters(Map<String, Set<String>> value) => controller.setState(() => controller._filters = value);
  List get filteredBooks => controller.filteredBooks;
  void showSortMenu(GlobalKey sortKey) => controller.showSortMenu(sortKey);

  static ReceiptBookScope of(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<ReceiptBookScope>()!;
  }

  @override
  bool updateShouldNotify(ReceiptBookScope oldWidget) => true;
}